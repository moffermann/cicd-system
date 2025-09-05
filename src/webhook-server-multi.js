#!/usr/bin/env node

import express from 'express';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { getDatabase } = require('./database/DatabaseManager.cjs');
const ServerConfig = require('./server/ServerConfig.cjs');
const RouteHandler = require('./server/RouteHandler.cjs');
const WebhookProcessor = require('./server/WebhookProcessor.cjs');
const NotificationManager = require('./notifications/NotificationManager.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MultiProjectWebhookServer - Refactored for better testability
 * 
 * This server handles GitHub webhooks for multiple projects and triggers
 * automated deployments based on configured rules.
 */
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

  /**
   * Initialize all server components
   */
  async initialize() {
    try {
      console.log('🚀 Starting Multi-Project CI/CD Webhook Server...');

      // Initialize database
      this.db = getDatabase();
      console.log('🗄️ Database connected:', this.db.dbPath);

      // Initialize server configuration
      this.serverConfig = new ServerConfig(this.configPath);
      await this.serverConfig.load();

      // Validate configuration
      const validation = this.serverConfig.validate();
      if (!validation.isValid) {
        throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
      }

      // Initialize notification manager
      this.notificationManager = new NotificationManager();

      // Initialize handlers
      this.routeHandler = new RouteHandler(this.db, this.serverConfig);
      this.webhookProcessor = new WebhookProcessor(this.db, this.notificationManager);
      
      // Setup Express
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();
      
      console.log('✅ Multi-project webhook server initialized');
      
    } catch (error) {
      console.error('❌ Server initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => this.routeHandler.logRequest(req, res, next));
    
    // CORS if enabled
    if (this.serverConfig.getValue('cors.enabled', false)) {
      this.setupCORS();
    }
  }

  /**
   * Setup CORS middleware
   */
  setupCORS() {
    const origins = this.serverConfig.getValue('cors.origins', ['*']);
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origins.includes('*') || origins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Setup all routes
   */
  setupRoutes() {
    // Core endpoints
    this.app.get('/health', (req, res) => this.routeHandler.handleHealthCheck(req, res));
    this.app.post('/webhook', (req, res) => this.webhookProcessor.processWebhook(req, res));
    
    // Legacy compatibility
    this.app.post('/ci-notification', (req, res) => this.routeHandler.handleCiNotification(req, res));

    // API endpoints
    this.app.get('/api/projects', (req, res) => this.routeHandler.handleGetProjects(req, res));
    this.app.get('/api/projects/:name', (req, res) => this.routeHandler.handleGetProject(req, res));
    this.app.get('/api/deployments', (req, res) => this.routeHandler.handleGetDeployments(req, res));

    // Admin endpoints (if enabled)
    if (this.serverConfig.isFeatureEnabled('admin')) {
      this.app.get('/admin/status', (req, res) => this.routeHandler.handleAdminStatus(req, res));
      this.app.get('/admin/deployments/active', (req, res) => {
        const active = this.webhookProcessor.getActiveDeployments();
        res.json({ success: true, active });
      });
    }
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => this.routeHandler.handleNotFound(req, res));
    
    // Error handler
    this.app.use((error, req, res, next) => this.routeHandler.handleError(error, req, res, next));
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();
      
      const port = this.serverConfig.getPort();
      
      this.server = this.app.listen(port, () => {
        console.log('\n🎉 ===== MULTI-PROJECT WEBHOOK SERVER READY =====');
        console.log(`🌐 Local URL: http://localhost:${port}`);
        console.log(`📊 Projects configured: ${this.db.getAllProjects().length}`);
        
        const projects = this.db.getAllProjects();
        projects.forEach(project => {
          console.log(`   📁 ${project.name} (${project.github_repo}) -> ${project.production_url}`);
        });
        
        console.log('🔗 Webhook endpoint: /webhook');
        console.log('📋 Health check: /health');
        console.log('🔧 API endpoints: /api/projects, /api/deployments');
        console.log('===============================================\n');
        console.log('💡 Ready to receive webhooks for all configured projects!');
        console.log('📝 Push to any configured repository to trigger deployment\n');
      });

      return this.server;
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    if (this.server) {
      console.log('🛑 Stopping webhook server...');
      
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ Webhook server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: !!this.server,
      port: this.serverConfig?.getPort(),
      projectCount: this.db?.getAllProjects().length || 0,
      activeDeployments: this.webhookProcessor?.getActiveDeployments() || []
    };
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MultiProjectWebhookServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n📡 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n📡 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  server.start().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

export default MultiProjectWebhookServer;