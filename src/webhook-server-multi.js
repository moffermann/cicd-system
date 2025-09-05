#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { getDatabase } = require('./database/DatabaseManager.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MultiProjectWebhookServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEBHOOK_PORT || 8765;
    this.configFile = path.join(__dirname, '..', 'webhook-config.json');
    this.db = null; // Database instance
    this.adminToken = null;
  }

  async initialize() {
    try {
      // Initialize database
      this.db = getDatabase();
      console.log('🗄️ Database initialized');

      // Load webhook configuration
      await this.loadWebhookConfig();
      
      // Setup Express middleware and routes
      this.setupMiddleware();
      this.setupRoutes();
      
      console.log('✅ Multi-project webhook server initialized');
      
    } catch (error) {
      console.error('❌ Server initialization failed:', error);
      throw error;
    }
  }

  async loadWebhookConfig() {
    try {
      const config = await fs.readFile(this.configFile, 'utf8');
      const data = JSON.parse(config);
      this.adminToken = data.adminToken;
      console.log('✅ Webhook configuration loaded');
    } catch (error) {
      console.log('⚠️ No webhook-config.json found, admin features disabled');
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const projects = this.db.getAllProjects();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        tunnel: this.currentTunnel,
        projects: projects.length,
        server_version: '2.0.0-multi-project'
      });
    });

    // Main webhook endpoint - handles all projects
    this.app.post('/webhook', async (req, res) => {
      await this.handleGitHubWebhook(req, res);
    });

    // Legacy CI notification endpoint (for backward compatibility)
    this.app.post('/ci-notification', (req, res) => {
      console.log('\n🔔 ===== CI NOTIFICATION RECEIVED =====');
      console.log('📅 Timestamp:', new Date().toLocaleString());
      console.log('📦 Payload:', JSON.stringify(req.body, null, 2));
      res.json({ success: true, message: 'Notification received' });
    });

    // Project management API
    this.app.get('/api/projects', (req, res) => {
      try {
        const projects = this.db.getAllProjects();
        res.json({ success: true, projects });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/projects/:name', (req, res) => {
      try {
        const project = this.db.getProject(req.params.name);
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, project });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Deployment history API
    this.app.get('/api/deployments', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const deployments = this.db.getRecentDeployments(limit);
        res.json({ success: true, deployments });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/projects/:name/deployments', (req, res) => {
      try {
        const project = this.db.getProject(req.params.name);
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }
        
        const limit = parseInt(req.query.limit) || 10;
        const deployments = this.db.getProjectDeployments(project.id, limit);
        res.json({ success: true, deployments });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Admin endpoint to reconfigure webhook
    this.app.post('/admin/reconfigure', async (req, res) => {
      try {
        if (this.currentTunnel) {
          // TODO: Configure webhooks for all active projects
          res.json({ success: true, message: 'Multi-project webhook reconfigured' });
        } else {
          res.status(400).json({ error: 'No tunnel active' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async handleGitHubWebhook(req, res) {
    try {
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      const payload = req.body;

      console.log(`\n🚀 ===== GITHUB WEBHOOK: ${event?.toUpperCase()} =====`);
      console.log(`📅 Timestamp: ${new Date().toLocaleString()}`);

      // Extract repository information
      const repository = payload.repository;
      if (!repository) {
        console.log('⚠️ No repository information in payload');
        return res.status(400).json({ error: 'Missing repository information' });
      }

      const repoFullName = repository.full_name; // e.g., "moffermann/cicd-system"
      console.log(`📦 Repository: ${repoFullName}`);

      // Find project in database
      const project = this.db.getProjectByRepo(repoFullName);
      if (!project) {
        console.log(`❌ Project not found for repository: ${repoFullName}`);
        console.log('💡 Available projects:');
        const allProjects = this.db.getAllProjects();
        allProjects.forEach(p => console.log(`   - ${p.name}: ${p.github_repo}`));
        
        return res.status(404).json({ 
          error: 'Project not found',
          repository: repoFullName,
          suggestion: 'Add this project to the database first'
        });
      }

      console.log(`✅ Found project: ${project.name}`);
      console.log(`🌐 Production URL: ${project.production_url}`);

      // Verify webhook signature if secret is configured
      if (project.webhook_secret) {
        if (!this.verifyWebhookSignature(JSON.stringify(payload), signature, project.webhook_secret)) {
          console.log('❌ Invalid webhook signature');
          return res.status(401).json({ error: 'Unauthorized - invalid signature' });
        }
        console.log('✅ Webhook signature verified');
      }

      // Handle push events
      if (event === 'push') {
        const ref = payload.ref;
        const targetBranch = `refs/heads/${project.main_branch}`;
        
        console.log(`📋 Push to: ${ref}`);
        console.log(`🎯 Target branch: ${targetBranch}`);

        if (ref === targetBranch) {
          console.log('🚀 TRIGGERING DEPLOYMENT!');
          
          // Create deployment record
          const deploymentId = this.db.createDeployment(project.id, {
            commit_hash: payload.head_commit?.id,
            commit_message: payload.head_commit?.message,
            branch: project.main_branch,
            triggered_by: 'webhook'
          });

          // Start deployment process
          this.triggerDeployment(project, deploymentId, payload);
          
          res.json({
            success: true,
            message: 'Deployment triggered',
            project: project.name,
            deployment_id: deploymentId,
            commit: payload.head_commit?.id?.substring(0, 7)
          });
        } else {
          console.log(`⏭️ Ignoring push to ${ref} (not target branch)`);
          res.json({
            success: true,
            message: 'Push received but not to target branch',
            project: project.name,
            pushed_branch: ref,
            target_branch: targetBranch
          });
        }
      } else {
        console.log(`📋 Event ${event} received but not handled`);
        res.json({
          success: true,
          message: `Event ${event} received but not handled`,
          project: project.name
        });
      }

      console.log('=======================================\n');

    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }

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

  triggerDeployment(project, deploymentId, webhookPayload) {
    try {
      console.log(`🔄 Starting deployment for ${project.name} (ID: ${deploymentId})`);
      
      // Update deployment status
      this.db.updateDeploymentStatus(deploymentId, 'running', 'initialization');
      this.db.addDeploymentLog(deploymentId, 'initialization', 'info', 
        `Deployment triggered by webhook for commit ${webhookPayload.head_commit?.id?.substring(0, 7)}`);

      // Execute deployment script with project-specific configuration
      const deployScript = path.join(__dirname, 'deploy-production.js');
      const env = {
        ...process.env,
        PROJECT_NAME: project.name,
        PRODUCTION_URL: project.production_url,
        STAGING_URL: project.staging_url,
        GITHUB_REPO: project.github_repo,
        DEPLOYMENT_ID: deploymentId.toString(),
        DEPLOY_PATH: project.deploy_path
      };

      console.log(`🚀 Executing deployment script with environment:`);
      console.log(`   PROJECT_NAME: ${env.PROJECT_NAME}`);
      console.log(`   PRODUCTION_URL: ${env.PRODUCTION_URL}`);

      const deployProcess = spawn('node', [deployScript], {
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle deployment process output
      deployProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[${project.name}] ${output}`);
        this.db.addDeploymentLog(deploymentId, 'deployment', 'info', output);
      });

      deployProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        console.error(`[${project.name}] ERROR: ${error}`);
        this.db.addDeploymentLog(deploymentId, 'deployment', 'error', error);
      });

      deployProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Deployment completed successfully for ${project.name}`);
          this.db.updateDeploymentStatus(deploymentId, 'success');
          this.db.addDeploymentLog(deploymentId, 'completion', 'info', 
            'Deployment completed successfully');
        } else {
          console.error(`❌ Deployment failed for ${project.name} with exit code ${code}`);
          this.db.updateDeploymentStatus(deploymentId, 'failed', null, 
            `Deployment process exited with code ${code}`);
          this.db.addDeploymentLog(deploymentId, 'completion', 'error', 
            `Deployment failed with exit code ${code}`);
        }
      });

    } catch (error) {
      console.error(`❌ Failed to trigger deployment for ${project.name}:`, error);
      this.db.updateDeploymentStatus(deploymentId, 'failed', null, error.message);
      this.db.addDeploymentLog(deploymentId, 'error', 'error', 
        `Failed to start deployment: ${error.message}`);
    }
  }


  async start() {
    try {
      console.log('🚀 Starting Multi-Project CI/CD Webhook Server...\n');
      
      // Initialize server
      await this.initialize();
      
      // Start HTTP server
      const server = this.app.listen(this.port, () => {
        console.log(`✅ HTTP server started on port ${this.port}`);
      });
      
      // Display startup summary
      const projects = this.db.getAllProjects();
      console.log('\n🎉 ===== MULTI-PROJECT WEBHOOK SERVER READY =====');
      console.log(`🌐 Local URL: http://localhost:${this.port}`);
      console.log(`📊 Projects configured: ${projects.length}`);
      projects.forEach(p => {
        console.log(`   📁 ${p.name} (${p.github_repo}) -> ${p.production_url}`);
      });
      console.log(`🔗 Webhook endpoint: /webhook`);
      console.log(`📋 Health check: /health`);
      console.log(`🔧 API endpoints: /api/projects, /api/deployments`);
      console.log('===============================================\n');
      console.log('💡 Ready to receive webhooks for all configured projects!');
      console.log('📝 Push to any configured repository to trigger deployment\n');
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down Multi-Project Webhook Server...');
        if (this.db) {
          this.db.close();
        }
        server.close();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
const server = new MultiProjectWebhookServer();
server.start().catch(console.error);

export default MultiProjectWebhookServer;