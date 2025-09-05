#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getDatabase } = require('./database/DatabaseManager.cjs');
const WebhookHandler = require('./webhook/WebhookHandler.cjs');
const Logger = require('./utils/Logger.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MultiProjectWebhookServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEBHOOK_PORT || 8765;
    this.ngrokProcess = null;
    this.currentTunnel = null;
    this.configFile = path.join(__dirname, '..', 'webhook-config.json');
    
    // Initialize components
    this.logger = new Logger('WebhookServer');
    this.db = null;
    this.webhookHandler = null;
    this.adminToken = null;
  }

  async initialize() {
    try {
      // Initialize database
      this.db = getDatabase();
      this.logger.success('Database initialized');

      // Initialize webhook handler
      this.webhookHandler = new WebhookHandler(this.db, this.logger);
      
      // Load webhook configuration
      await this.loadWebhookConfig();
      
      // Setup Express
      this.setupExpress();
      
      this.logger.success('Multi-project webhook server initialized');
      
    } catch (error) {
      this.logger.error(`Server initialization failed: ${error.message}`);
      throw error;
    }
  }

  async loadWebhookConfig() {
    try {
      const config = await fs.readFile(this.configFile, 'utf8');
      const data = JSON.parse(config);
      this.adminToken = data.adminToken;
      this.logger.success('Webhook configuration loaded');
    } catch (error) {
      this.logger.warn('No webhook-config.json found, admin features disabled');
    }
  }

  setupExpress() {
    // Middleware
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      this.logger.log(`📡 ${req.method} ${req.path}`);
      next();
    });

    // Routes
    this.setupApiRoutes();
    this.setupWebhookRoutes();
    this.setupAdminRoutes();
  }

  setupApiRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const projects = this.db.getAllProjects();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        tunnel: this.currentTunnel,
        projects: projects.length,
        server_version: '2.0.0-multi-project-refactored'
      });
    });

    // Projects API
    this.app.get('/api/projects', this.handleGetProjects.bind(this));
    this.app.get('/api/projects/:name', this.handleGetProject.bind(this));
    
    // Deployments API  
    this.app.get('/api/deployments', this.handleGetDeployments.bind(this));
    this.app.get('/api/projects/:name/deployments', this.handleGetProjectDeployments.bind(this));
  }

  setupWebhookRoutes() {
    // Main webhook endpoint
    this.app.post('/webhook', this.handleWebhook.bind(this));
    
    // Legacy CI notification endpoint
    this.app.post('/ci-notification', (req, res) => {
      this.logger.log('🔔 Legacy CI notification received');
      this.logger.log(`📦 Payload: ${JSON.stringify(req.body, null, 2)}`);
      res.json({ success: true, message: 'Notification received' });
    });
  }

  setupAdminRoutes() {
    this.app.post('/admin/reconfigure', this.handleAdminReconfigure.bind(this));
  }

  // Route Handlers
  async handleWebhook(req, res) {
    try {
      const result = await this.webhookHandler.processWebhook(req);
      this.logger.log('=======================================\n');
      res.json(result);
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        error: error.message,
        suggestion: error.message.includes('not found') ? 'Add this project to the database first' : undefined
      });
    }
  }

  handleGetProjects(req, res) {
    try {
      const projects = this.db.getAllProjects();
      res.json({ success: true, projects });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  handleGetProject(req, res) {
    try {
      const project = this.db.getProject(req.params.name);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      res.json({ success: true, project });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  handleGetDeployments(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const deployments = this.db.getRecentDeployments(limit);
      res.json({ success: true, deployments });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  handleGetProjectDeployments(req, res) {
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
  }

  async handleAdminReconfigure(req, res) {
    try {
      if (this.currentTunnel) {
        res.json({ success: true, message: 'Multi-project webhook reconfigured' });
      } else {
        res.status(400).json({ error: 'No tunnel active' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async startNgrok() {
    if (process.env.ENABLE_NGROK === 'false') {
      this.logger.warn('Ngrok disabled via ENABLE_NGROK=false');
      return null;
    }

    return new Promise((resolve, reject) => {
      this.logger.log('🚀 Starting ngrok tunnel...');
      
      const authToken = process.env.NGROK_AUTHTOKEN || 'your-ngrok-token';
      this.ngrokProcess = spawn('ngrok', ['http', this.port, '--authtoken', authToken], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timeout = setTimeout(() => {
        if (!this.currentTunnel) {
          reject(new Error('Ngrok failed to start within 30 seconds'));
        }
      }, 30000);

      this.ngrokProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
        if (urlMatch) {
          this.currentTunnel = urlMatch[0];
          this.logger.success(`Ngrok tunnel active: ${this.currentTunnel}`);
          clearTimeout(timeout);
          resolve(this.currentTunnel);
        }
      });

      this.ngrokProcess.stderr.on('data', (data) => {
        this.logger.error(`ngrok error: ${data.toString()}`);
      });

      this.ngrokProcess.on('close', (code) => {
        if (code !== 0 && this.currentTunnel) {
          this.logger.warn(`ngrok closed with code: ${code}, attempting restart...`);
          setTimeout(() => this.startNgrok().catch(() => {}), 5000);
        }
      });
    });
  }

  async start() {
    try {
      this.logger.log('🚀 Starting Multi-Project CI/CD Webhook Server...\n');
      
      await this.initialize();
      
      // Start HTTP server
      const server = this.app.listen(this.port, () => {
        this.logger.success(`HTTP server started on port ${this.port}`);
      });
      
      // Start ngrok if enabled
      try {
        const tunnelUrl = await this.startNgrok();
        if (tunnelUrl) {
          this.logger.success(`Public URL: ${tunnelUrl}`);
          this.logger.success(`Webhook endpoint: ${tunnelUrl}/webhook`);
        }
      } catch (error) {
        this.logger.warn(`Ngrok failed to start: ${error.message}`);
        this.logger.warn('Continuing without public URL');
      }
      
      this.displayStartupSummary();
      this.setupGracefulShutdown(server);
      
    } catch (error) {
      this.logger.error(`Server startup failed: ${error.message}`);
      process.exit(1);
    }
  }

  displayStartupSummary() {
    const projects = this.db.getAllProjects();
    
    this.logger.log('\n🎉 ===== MULTI-PROJECT WEBHOOK SERVER READY =====');
    this.logger.log(`🌐 Local URL: http://localhost:${this.port}`);
    this.logger.log(`📊 Projects configured: ${projects.length}`);
    
    projects.forEach(p => {
      this.logger.log(`   📁 ${p.name} (${p.github_repo}) -> ${p.production_url}`);
    });
    
    this.logger.log(`🔗 Webhook endpoint: /webhook`);
    this.logger.log(`📋 Health check: /health`);
    this.logger.log(`🔧 API endpoints: /api/projects, /api/deployments`);
    this.logger.log('===============================================\n');
    this.logger.log('💡 Ready to receive webhooks for all configured projects!');
    this.logger.log('📝 Push to any configured repository to trigger deployment\n');
  }

  setupGracefulShutdown(server) {
    process.on('SIGINT', () => {
      this.logger.log('\n🛑 Shutting down Multi-Project Webhook Server...');
      
      if (this.ngrokProcess) {
        this.ngrokProcess.kill();
      }
      
      if (this.db) {
        this.db.close();
      }
      
      server.close();
      process.exit(0);
    });
  }
}

// Start server
const server = new MultiProjectWebhookServer();
server.start().catch(console.error);

export default MultiProjectWebhookServer;