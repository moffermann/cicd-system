#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { getDatabase } = require('./database/DatabaseManager.cjs');
const ServerConfig = require('./server/ServerConfig.cjs');
const RouteHandler = require('./server/RouteHandler.cjs');
const WebhookProcessor = require('./server/WebhookProcessor.cjs');
const NotificationManager = require('./notifications/NotificationManager.cjs');

class MultiProjectWebhookServer {
  constructor(configPath = null) {
    this.app = express();
    this.configPath = configPath || path.join(__dirname, '..', 'webhook-config.json');
    
    // Components (initialized in initialize())
    this.db = null;
    this.serverConfig = null;
    this.routeHandler = null;
    this.webhookProcessor = null;
    this.notificationManager = null;
    this.server = null;
  }

  async initialize() {
    try {
      // Initialize database
      this.db = getDatabase();
      console.log('🗄️ Database initialized');

      // Initialize server configuration  
      this.serverConfig = new ServerConfig(this.configPath);
      await this.serverConfig.load();

      // Initialize components
      this.notificationManager = new NotificationManager();
      this.routeHandler = new RouteHandler(this.db, this.serverConfig);
      this.webhookProcessor = new WebhookProcessor(this.db, this.notificationManager);
      
      // Setup Express middleware and routes
      this.setupMiddleware();
      this.setupRoutes();
      
      console.log('✅ Multi-project webhook server initialized');
      
    } catch (error) {
      console.error('❌ Server initialization failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    
    // Request logging middleware
    this.app.use((req, res, next) => this.routeHandler.logRequest(req, res, next));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => this.routeHandler.handleHealthCheck(req, res));

    // Main webhook endpoint - handles all projects
    this.app.post('/webhook', (req, res) => this.webhookProcessor.processWebhook(req, res));

    // Legacy CI notification endpoint  
    this.app.post('/ci-notification', (req, res) => this.routeHandler.handleCiNotification(req, res));

    // Project management API
    this.app.get('/api/projects', (req, res) => this.routeHandler.handleGetProjects(req, res));
    this.app.get('/api/projects/:name', (req, res) => this.routeHandler.handleGetProject(req, res));

    // Deployment history API
    this.app.get('/api/deployments', (req, res) => this.routeHandler.handleGetDeployments(req, res));
    this.app.get('/api/projects/:name/deployments', (req, res) => this.routeHandler.handleGetProjectDeployments(req, res));

    // Admin endpoints
    this.app.post('/admin/reconfigure', (req, res) => this.routeHandler.handleAdminReconfigure(req, res));
  }



  async start() {
    try {
      console.log('🚀 Starting Multi-Project CI/CD Webhook Server...\n');
      
      // Initialize server
      await this.initialize();
      
      // Get port from configuration
      const port = this.serverConfig.getPort();
      
      // Start HTTP server
      this.server = this.app.listen(port, () => {
        console.log(`✅ HTTP server started on port ${port}`);
      });
      
      // Display startup summary
      const projects = this.db.getAllProjects();
      console.log('\n🎉 ===== MULTI-PROJECT WEBHOOK SERVER READY =====');
      console.log(`🌐 Local URL: http://localhost:${port}`);
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
        if (this.server) {
          this.server.close();
        }
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new MultiProjectWebhookServer();
  server.start().catch(console.error);
}

module.exports = MultiProjectWebhookServer;