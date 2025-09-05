const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const NotificationManager = require('../notifications/NotificationManager.cjs');

/**
 * WebhookHandler - Handles GitHub webhook processing and deployment triggering
 */
class WebhookHandler {
  constructor(database, logger) {
    this.db = database;
    this.logger = logger;
    this.notifications = new NotificationManager();
  }

  /**
   * Main webhook processing entry point
   */
  async processWebhook(req) {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const payload = req.body;

    this.logger.log(`🚀 ===== GITHUB WEBHOOK: ${event?.toUpperCase()} =====`);
    this.logger.log(`📅 Timestamp: ${new Date().toLocaleString()}`);

    // Extract repository information
    const repository = payload.repository;
    if (!repository) {
      throw new Error('Missing repository information in payload');
    }

    const repoFullName = repository.full_name;
    this.logger.log(`📦 Repository: ${repoFullName}`);

    // Find project in database
    const project = this.db.getProjectByRepo(repoFullName);
    if (!project) {
      const availableProjects = this.db.getAllProjects();
      this.logger.log(`❌ Project not found for repository: ${repoFullName}`);
      this.logger.log('💡 Available projects:');
      availableProjects.forEach(p => this.logger.log(`   - ${p.name}: ${p.github_repo}`));
      
      throw new Error(`Project not found for repository: ${repoFullName}`);
    }

    this.logger.log(`✅ Found project: ${project.name}`);
    this.logger.log(`🌐 Production URL: ${project.production_url}`);

    // Verify webhook signature if secret is configured
    if (project.webhook_secret) {
      if (!this.verifyWebhookSignature(JSON.stringify(payload), signature, project.webhook_secret)) {
        throw new Error('Invalid webhook signature');
      }
      this.logger.log('✅ Webhook signature verified');
    }

    // Process based on event type
    return await this.processEvent(event, payload, project);
  }

  /**
   * Process specific webhook event types
   */
  async processEvent(event, payload, project) {
    switch (event) {
      case 'push':
        return await this.processPushEvent(payload, project);
      
      case 'pull_request':
        return await this.processPullRequestEvent(payload, project);
      
      default:
        this.logger.log(`📋 Event ${event} received but not handled`);
        return {
          success: true,
          message: `Event ${event} received but not handled`,
          project: project.name,
          action: 'ignored'
        };
    }
  }

  /**
   * Handle push events
   */
  async processPushEvent(payload, project) {
    const ref = payload.ref;
    const targetBranch = `refs/heads/${project.main_branch}`;
    
    this.logger.log(`📋 Push to: ${ref}`);
    this.logger.log(`🎯 Target branch: ${targetBranch}`);

    if (ref === targetBranch) {
      this.logger.log('🚀 TRIGGERING DEPLOYMENT!');
      
      // Create deployment record
      const deploymentId = this.db.createDeployment(project.id, {
        commit_hash: payload.head_commit?.id,
        commit_message: payload.head_commit?.message,
        branch: project.main_branch,
        triggered_by: 'webhook'
      });

      // Start deployment process
      this.triggerDeployment(project, deploymentId, payload);
      
      return {
        success: true,
        message: 'Deployment triggered',
        project: project.name,
        deployment_id: deploymentId,
        commit: payload.head_commit?.id?.substring(0, 7),
        action: 'deploy'
      };
    } else {
      this.logger.log(`⏭️ Ignoring push to ${ref} (not target branch)`);
      return {
        success: true,
        message: 'Push received but not to target branch',
        project: project.name,
        pushed_branch: ref,
        target_branch: targetBranch,
        action: 'ignored'
      };
    }
  }

  /**
   * Handle pull request events
   */
  async processPullRequestEvent(payload, project) {
    const action = payload.action;
    const pullRequest = payload.pull_request;
    
    this.logger.log(`📋 Pull Request ${action}: #${pullRequest.number}`);
    
    if (action === 'opened' || action === 'synchronize') {
      // Could trigger staging deployment for PR preview
      this.logger.log('💡 PR deployment not implemented yet');
    }
    
    return {
      success: true,
      message: `Pull request ${action} processed`,
      project: project.name,
      pr_number: pullRequest.number,
      action: 'acknowledged'
    };
  }

  /**
   * Verify webhook signature using HMAC
   */
  verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) return false;
    
    const expectedSignature = 'sha256=' + 
      crypto.createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Trigger deployment process
   */
  triggerDeployment(project, deploymentId, webhookPayload) {
    try {
      this.logger.log(`🔄 Starting deployment for ${project.name} (ID: ${deploymentId})`);
      
      // Update deployment status
      this.db.updateDeploymentStatus(deploymentId, 'running', 'initialization');
      this.db.addDeploymentLog(deploymentId, 'initialization', 'info', 
        `Deployment triggered by webhook for commit ${webhookPayload.head_commit?.id?.substring(0, 7)}`);

      // Execute deployment script with project-specific configuration
      const deployScript = path.join(__dirname, '..', 'deploy-production.js');
      const env = this.buildDeploymentEnvironment(project, deploymentId, webhookPayload);

      this.logger.log(`🚀 Executing deployment script with environment:`);
      this.logger.log(`   PROJECT_NAME: ${env.PROJECT_NAME}`);
      this.logger.log(`   PRODUCTION_URL: ${env.PRODUCTION_URL}`);

      const deployProcess = spawn('node', [deployScript], {
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle deployment process output
      deployProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.logger.log(`[${project.name}] ${output}`);
        this.db.addDeploymentLog(deploymentId, 'deployment', 'info', output);
      });

      deployProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        this.logger.log(`[${project.name}] ERROR: ${error}`, 'red');
        this.db.addDeploymentLog(deploymentId, 'deployment', 'error', error);
      });

      deployProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`✅ Deployment completed successfully for ${project.name}`, 'green');
          this.db.updateDeploymentStatus(deploymentId, 'success');
          this.db.addDeploymentLog(deploymentId, 'completion', 'info', 
            'Deployment completed successfully');
        } else {
          this.logger.log(`❌ Deployment failed for ${project.name} with exit code ${code}`, 'red');
          this.db.updateDeploymentStatus(deploymentId, 'failed', null, 
            `Deployment process exited with code ${code}`);
          this.db.addDeploymentLog(deploymentId, 'completion', 'error', 
            `Deployment failed with exit code ${code}`);
        }
      });

    } catch (error) {
      this.logger.log(`❌ Failed to trigger deployment for ${project.name}: ${error.message}`, 'red');
      this.db.updateDeploymentStatus(deploymentId, 'failed', null, error.message);
      this.db.addDeploymentLog(deploymentId, 'error', 'error', 
        `Failed to start deployment: ${error.message}`);
    }
  }

  /**
   * Build environment variables for deployment process
   */
  buildDeploymentEnvironment(project, deploymentId, webhookPayload) {
    return {
      ...process.env,
      PROJECT_NAME: project.name,
      PRODUCTION_URL: project.production_url,
      STAGING_URL: project.staging_url,
      GITHUB_REPO: project.github_repo,
      DEPLOYMENT_ID: deploymentId.toString(),
      DEPLOY_PATH: project.deploy_path,
      MAIN_BRANCH: project.main_branch,
      WEBHOOK_SECRET: project.webhook_secret,
      COMMIT_HASH: webhookPayload.head_commit?.id,
      COMMIT_MESSAGE: webhookPayload.head_commit?.message,
      DEPLOYMENT_TIMEOUT: project.deployment_timeout?.toString()
    };
  }
}

module.exports = WebhookHandler;