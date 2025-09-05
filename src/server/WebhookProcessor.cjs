const WebhookHandler = require('../webhook/WebhookHandler.cjs');

/**
 * WebhookProcessor - Process GitHub webhooks for multi-project deployments
 */
class WebhookProcessor {
    constructor(database, notificationManager = null) {
        this.db = database;
        this.notificationManager = notificationManager;
        this.webhookHandler = new WebhookHandler();
        this.activeDeployments = new Map(); // Track active deployments
    }

    /**
     * Process incoming GitHub webhook
     */
    async processWebhook(req, res) {
        try {
            console.log('\n🔔 ===== WEBHOOK RECEIVED =====');
            console.log('📅 Timestamp:', new Date().toLocaleString());
            console.log('📦 Event Type:', req.headers['x-github-event']);

            const event = req.headers['x-github-event'];
            const payload = req.body;

            // Validate payload
            if (!payload || !payload.repository) {
                console.log('❌ Invalid webhook payload - missing repository');
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid webhook payload' 
                });
            }

            const repoName = payload.repository.full_name;
            console.log('📦 Repository:', repoName);

            // Find project configuration
            const project = this.db.getProjectByRepo(repoName);
            if (!project) {
                console.log(`❌ No configuration found for repository: ${repoName}`);
                return res.status(404).json({ 
                    success: false, 
                    message: 'Repository not configured for deployment' 
                });
            }

            // Verify webhook signature if secret is configured
            if (project.webhook_secret) {
                const signature = req.headers['x-hub-signature-256'];
                if (!this.webhookHandler.verifySignature(payload, signature, project.webhook_secret)) {
                    console.log('❌ Webhook signature verification failed');
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Webhook signature verification failed' 
                    });
                }
            }

            // Process the webhook based on event type
            const result = await this.handleWebhookEvent(event, payload, project);

            return res.json({
                success: true,
                message: result.message,
                deployment_id: result.deploymentId || null
            });

        } catch (error) {
            console.error('❌ Webhook processing failed:', error);
            return res.status(500).json({
                success: false,
                message: 'Webhook processing failed',
                error: error.message
            });
        }
    }

    /**
     * Handle different webhook event types
     */
    async handleWebhookEvent(event, payload, project) {
        switch (event) {
            case 'push':
                return await this.handlePushEvent(payload, project);
            
            case 'pull_request':
                return await this.handlePullRequestEvent(payload, project);
            
            case 'release':
                return await this.handleReleaseEvent(payload, project);
            
            default:
                console.log(`ℹ️ Ignoring webhook event: ${event}`);
                return { message: `Event ${event} ignored`, deploymentId: null };
        }
    }

    /**
     * Handle push events
     */
    async handlePushEvent(payload, project) {
        const branch = payload.ref.replace('refs/heads/', '');
        const commit = payload.head_commit;

        console.log(`📝 Push to branch: ${branch}`);
        console.log(`📝 Commit: ${commit.id.substring(0, 7)} - ${commit.message}`);

        // Check if we should deploy this branch
        if (branch !== project.main_branch) {
            console.log(`ℹ️ Ignoring push to ${branch} - not the main branch (${project.main_branch})`);
            return { message: `Push to ${branch} ignored - not main branch` };
        }

        // Check for active deployment
        if (this.activeDeployments.has(project.name)) {
            console.log(`⚠️ Deployment already in progress for ${project.name}`);
            return { message: 'Deployment already in progress' };
        }

        // Start deployment
        return await this.startDeployment(project, {
            trigger: 'push',
            branch,
            commit: commit.id,
            author: commit.author.name,
            message: commit.message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle pull request events
     */
    async handlePullRequestEvent(payload, project) {
        const action = payload.action;
        const pr = payload.pull_request;

        console.log(`📝 Pull request ${action}: #${pr.number} - ${pr.title}`);

        // Only handle specific PR actions
        if (!['opened', 'synchronize', 'closed'].includes(action)) {
            return { message: `PR action ${action} ignored` };
        }

        // For now, we'll just log PR events
        // In the future, we could trigger preview deployments
        console.log(`ℹ️ PR webhook received but not triggering deployment`);
        return { message: `Pull request ${action} logged` };
    }

    /**
     * Handle release events
     */
    async handleReleaseEvent(payload, project) {
        const action = payload.action;
        const release = payload.release;

        console.log(`📝 Release ${action}: ${release.tag_name}`);

        if (action === 'published') {
            // Trigger production deployment for releases
            return await this.startDeployment(project, {
                trigger: 'release',
                version: release.tag_name,
                branch: project.main_branch,
                commit: release.target_commitish,
                timestamp: new Date().toISOString()
            });
        }

        return { message: `Release ${action} logged` };
    }

    /**
     * Start a new deployment
     */
    async startDeployment(project, context) {
        try {
            // Create deployment record
            const deploymentId = await this.db.createDeployment({
                project_name: project.name,
                trigger: context.trigger,
                branch: context.branch,
                commit: context.commit,
                status: 'pending',
                environment: project.environment || 'production',
                triggered_by: context.author || 'webhook',
                metadata: JSON.stringify(context)
            });

            console.log(`🚀 Starting deployment ${deploymentId} for ${project.name}`);

            // Mark deployment as active
            this.activeDeployments.set(project.name, deploymentId);

            // Send notification if available
            if (this.notificationManager) {
                await this.notificationManager.sendDeploymentNotification({
                    project: project.name,
                    status: 'started',
                    trigger: context.trigger,
                    branch: context.branch,
                    commit: context.commit,
                    deploymentId
                });
            }

            // Start deployment process asynchronously
            this.executeDeployment(project, deploymentId, context)
                .catch(error => {
                    console.error(`❌ Deployment ${deploymentId} failed:`, error);
                    this.activeDeployments.delete(project.name);
                });

            return {
                message: `Deployment started for ${project.name}`,
                deploymentId
            };

        } catch (error) {
            console.error('❌ Failed to start deployment:', error);
            throw error;
        }
    }

    /**
     * Execute the deployment process
     */
    async executeDeployment(project, deploymentId, context) {
        try {
            // This is a placeholder for the actual deployment logic
            // In a real implementation, this would:
            // 1. Clone/update repository
            // 2. Run build process
            // 3. Deploy to target environment
            // 4. Run health checks
            // 5. Send notifications

            console.log(`🔄 Executing deployment ${deploymentId}...`);

            // Update deployment status
            await this.db.updateDeploymentStatus(deploymentId, 'running', 'Deployment in progress');

            // Simulate deployment process (replace with actual logic)
            await this.sleep(5000); // 5 second deployment simulation

            // Mark deployment as completed
            await this.db.updateDeploymentStatus(deploymentId, 'success', 'Deployment completed successfully');

            console.log(`✅ Deployment ${deploymentId} completed successfully`);

            // Send success notification
            if (this.notificationManager) {
                await this.notificationManager.sendDeploymentNotification({
                    project: project.name,
                    status: 'success',
                    deploymentId,
                    url: project.production_url
                });
            }

        } catch (error) {
            await this.db.updateDeploymentStatus(deploymentId, 'failed', error.message);

            // Send failure notification
            if (this.notificationManager) {
                await this.notificationManager.sendDeploymentNotification({
                    project: project.name,
                    status: 'failed',
                    deploymentId,
                    error: error.message
                });
            }

            throw error;
        } finally {
            // Remove from active deployments
            this.activeDeployments.delete(project.name);
        }
    }

    /**
     * Get active deployments
     */
    getActiveDeployments() {
        return Array.from(this.activeDeployments.entries()).map(([project, deploymentId]) => ({
            project,
            deploymentId
        }));
    }

    /**
     * Cancel a deployment (if possible)
     */
    async cancelDeployment(project) {
        const deploymentId = this.activeDeployments.get(project);
        if (deploymentId) {
            this.activeDeployments.delete(project);
            await this.db.updateDeploymentStatus(deploymentId, 'cancelled', 'Deployment cancelled');
            return true;
        }
        return false;
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = WebhookProcessor;