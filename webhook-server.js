#!/usr/bin/env node
/**
 * 🚀 Universal CI/CD Webhook Server
 * 
 * Enterprise-grade webhook processor for multiple projects
 * - GitHub webhook signature verification
 * - Multi-project routing and deployment
 * - Comprehensive tracing and logging
 * - Multi-channel notifications
 * 
 * @version 1.0.0
 * @author GOCODE Team
 */

import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tdbot_webhook_verify_2024_secure';

// Middleware
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard/public')));

// Services
import TracingService from './tracing/tracingService.js';
import NotificationService from './notifications/notificationService.js';
import DeploymentEngine from './deployment/deploymentEngine.js';

const tracing = new TracingService();
const notifications = new NotificationService();
const deployment = new DeploymentEngine();

/**
 * Load project configurations
 */
async function loadProjectConfig() {
  try {
    const configPath = path.join(__dirname, 'config', 'projects.json');
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Failed to load project config:', error.message);
    return {};
  }
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(payload, signature) {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const receivedSignature = signature.replace('sha256=', '');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Main webhook handler
 */
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const delivery = req.headers['x-github-delivery'];
  const event = req.headers['x-github-event'];
  
  console.log(`\n🔔 Webhook received: ${event} (${delivery})`);
  
  // Start tracing
  const traceId = await tracing.startTrace('webhook', {
    event,
    delivery,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Verify signature
    await tracing.logStep(traceId, 'signature-verification', 'starting');
    
    if (!verifyGitHubSignature(req.body, signature)) {
      await tracing.logStep(traceId, 'signature-verification', 'failed', {
        signature: signature ? signature.substring(0, 20) + '...' : 'missing'
      });
      await tracing.completeTrace(traceId, false);
      
      console.log('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    await tracing.logStep(traceId, 'signature-verification', 'completed');
    
    // Parse payload
    const payload = JSON.parse(req.body.toString());
    const { ref, repository, head_commit } = payload;
    
    await tracing.logStep(traceId, 'payload-parsing', 'completed', {
      repository: repository?.name,
      ref,
      commit: head_commit?.id?.substring(0, 8)
    });
    
    // Load project configuration
    const projects = await loadProjectConfig();
    const projectName = repository?.name;
    const projectConfig = projects[projectName];
    
    if (!projectConfig) {
      await tracing.logStep(traceId, 'project-validation', 'failed', {
        reason: 'Project not configured',
        available: Object.keys(projects)
      });
      await tracing.completeTrace(traceId, false);
      
      console.log(`⚠️ Project not configured: ${projectName}`);
      return res.json({ 
        message: 'Project not configured',
        project: projectName,
        available: Object.keys(projects)
      });
    }
    
    await tracing.logStep(traceId, 'project-validation', 'completed', {
      project: projectName,
      branch: projectConfig.branch
    });
    
    // Check branch
    const targetBranch = `refs/heads/${projectConfig.branch}`;
    if (ref !== targetBranch) {
      await tracing.logStep(traceId, 'branch-validation', 'skipped', {
        received: ref,
        expected: targetBranch
      });
      await tracing.completeTrace(traceId, true);
      
      console.log(`⏭️ Ignoring branch: ${ref} (expected: ${targetBranch})`);
      return res.json({ 
        message: 'Branch ignored',
        received: ref,
        expected: targetBranch
      });
    }
    
    await tracing.logStep(traceId, 'branch-validation', 'completed');
    
    // Execute deployment
    console.log(`🚀 Starting deployment for ${projectName}...`);
    
    const deploymentResult = await deployment.execute(projectConfig, {
      commit: head_commit?.id?.substring(0, 8),
      message: head_commit?.message,
      author: head_commit?.author?.name,
      traceId
    });
    
    // Send notifications
    if (deploymentResult.success) {
      await notifications.sendSuccess(projectName, deploymentResult, traceId);
    } else {
      await notifications.sendFailure(projectName, deploymentResult, traceId);
    }
    
    await tracing.completeTrace(traceId, deploymentResult.success);
    
    console.log(`${deploymentResult.success ? '✅' : '❌'} Deployment completed for ${projectName}`);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      project: projectName,
      traceId,
      deployment: deploymentResult
    });
    
  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    
    await tracing.logError(traceId, error);
    await tracing.completeTrace(traceId, false);
    
    res.status(500).json({
      success: false,
      error: error.message,
      traceId
    });
  }
});

/**
 * Webhook status endpoint
 */
app.get('/webhook/status', (req, res) => {
  res.json({
    service: 'Universal CI/CD Webhook Server',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * API Routes
 */

// Tracing endpoints
app.get('/api/trace/latest', async (req, res) => {
  try {
    const trace = await tracing.getLatestTrace();
    res.json({ success: true, trace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/trace/:id', async (req, res) => {
  try {
    const trace = await tracing.getTrace(req.params.id);
    if (!trace) {
      return res.status(404).json({ success: false, error: 'Trace not found' });
    }
    res.json({ success: true, trace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/trace/project/:name', async (req, res) => {
  try {
    const traces = await tracing.getProjectTraces(req.params.name);
    res.json({ success: true, traces });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Project management endpoints
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await loadProjectConfig();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/:name/deploy', async (req, res) => {
  try {
    const projectName = req.params.name;
    const projects = await loadProjectConfig();
    const projectConfig = projects[projectName];
    
    if (!projectConfig) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
    
    const traceId = await tracing.startTrace('manual-deploy', {
      project: projectName,
      trigger: 'manual',
      timestamp: new Date().toISOString()
    });
    
    const result = await deployment.execute(projectConfig, {
      commit: 'manual',
      message: 'Manual deployment trigger',
      author: 'Manual',
      traceId
    });
    
    await tracing.completeTrace(traceId, result.success);
    
    res.json({
      success: true,
      message: 'Manual deployment triggered',
      traceId,
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    service: 'Universal CI/CD System',
    status: 'healthy',
    components: {
      webhook: 'online',
      tracing: 'active',
      notifications: 'ready',
      deployment: 'standby'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/public/index.html'));
});

app.get('/', (req, res) => {
  res.json({
    service: '🚀 Universal CI/CD System',
    version: '1.0.0',
    description: 'Enterprise-grade CI/CD with multi-project support',
    endpoints: {
      webhook: '/webhook',
      dashboard: '/dashboard',
      api: '/api',
      health: '/api/health'
    },
    documentation: 'https://github.com/gocode/cicd-system',
    status: 'operational'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Universal CI/CD System Started
================================
🌐 Server: http://localhost:${PORT}
📡 Webhook: http://localhost:${PORT}/webhook
📊 Dashboard: http://localhost:${PORT}/dashboard
🏥 Health: http://localhost:${PORT}/api/health

📋 Configuration:
   • Port: ${PORT}
   • Secret: ${WEBHOOK_SECRET ? '✅ Configured' : '❌ Missing'}
   • Environment: ${process.env.NODE_ENV || 'development'}

✅ Ready to receive webhooks!
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});