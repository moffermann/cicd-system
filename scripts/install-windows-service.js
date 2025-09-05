#!/usr/bin/env node

/**
 * Windows Service Installer for CI/CD Webhook Server
 * Creates a Windows service that auto-starts the webhook server
 */

const Service = require('node-windows').Service;
const path = require('path');

// Define the service
const svc = new Service({
  name: 'CICD-Webhook-Server',
  description: 'CI/CD Multi-Project Webhook Server - Auto-deployment system',
  script: path.join(__dirname, '..', 'src', 'webhook-server-multi.js'),
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "WEBHOOK_PORT", 
      value: "8765"
    },
    {
      name: "DISABLE_NGROK",
      value: "true"
    }
  ]
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', function() {
  console.log('✅ Windows Service installed successfully!');
  console.log('🔧 Service Name: CICD-Webhook-Server');
  console.log('📁 Service Path:', svc.script);
  console.log('🚀 Starting service...');
  svc.start();
});

// Listen for the "start" event and confirm the service started
svc.on('start', function() {
  console.log('🎉 CI/CD Webhook Server service started successfully!');
  console.log('🌐 Local webhook URL: http://localhost:8765');
  console.log('🔗 Webhook endpoint: http://localhost:8765/webhook');
  console.log('📋 Health check: http://localhost:8765/health');
  console.log('');
  console.log('✅ Service will auto-start on Windows boot');
  console.log('🔧 Manage service via Windows Services (services.msc)');
  console.log('📝 Service logs available in Event Viewer');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('❌ Service error:', err);
});

// Check if we're running as administrator
function isAdmin() {
  try {
    require('child_process').execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Main execution
console.log('🔧 Installing CI/CD Webhook Server as Windows Service...\n');

if (!isAdmin()) {
  console.error('❌ ERROR: This script must be run as Administrator');
  console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
  console.error('📋 Then run: node scripts/install-windows-service.js');
  process.exit(1);
}

console.log('👤 Running as Administrator ✅');
console.log('📁 Script path:', svc.script);
console.log('🔧 Installing service...\n');

// Install the service
svc.install();