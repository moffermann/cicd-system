#!/usr/bin/env node

/**
 * SSH Tunnel Windows Service Installer
 * Creates a Windows service for persistent SSH tunnel to gocode.cl
 */

const Service = require('node-windows').Service;
const path = require('path');

// Define the service
const svc = new Service({
  name: 'CICD-SSH-Tunnel',
  description: 'CI/CD SSH Tunnel Service - Maintains persistent tunnel to gocode.cl for webhook notifications',
  script: path.join(__dirname, 'ssh-tunnel-service-wrapper.cjs'),
  nodeOptions: [
    '--max_old_space_size=1024'
  ],
  env: [
    {
      name: "TUNNEL_PORT",
      value: "9001"
    },
    {
      name: "LOCAL_PORT", 
      value: "8765"
    },
    {
      name: "REMOTE_HOST",
      value: "ubuntu@gocode.cl"
    },
    {
      name: "SSH_KEY_PATH",
      value: "C:\\Users\\Mauro\\.ssh\\id_rsa"
    },
    {
      name: "CHECK_INTERVAL",
      value: "30"
    }
  ]
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('✅ SSH Tunnel Windows Service installed successfully!');
  console.log('🔧 Service Name: CICD-SSH-Tunnel');
  console.log('📁 Service Path:', svc.script);
  console.log('🔗 Tunnel: gocode.cl:9001 ← localhost:8765');
  console.log('🚀 Starting service...');
  svc.start();
});

// Listen for the "start" event
svc.on('start', function() {
  console.log('🎉 SSH Tunnel service started successfully!');
  console.log('🔗 SSH Tunnel: gocode.cl:9001 ← localhost:8765');
  console.log('📡 Webhook notifications will now flow from server to local');
  console.log('');
  console.log('✅ Service will auto-start on Windows boot');
  console.log('🔧 Manage service via Windows Services (services.msc)');
  console.log('📝 Service logs available in Event Viewer');
  console.log('');
  console.log('🧪 Test connection:');
  console.log('   1. Start local webhook server (port 8765)');
  console.log('   2. Server notifications should reach your machine');
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
console.log('🔧 Installing SSH Tunnel as Windows Service...\n');

if (!isAdmin()) {
  console.error('❌ ERROR: This script must be run as Administrator');
  console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
  console.error('📋 Then run: node scripts/install-ssh-tunnel-service.js');
  process.exit(1);
}

console.log('👤 Running as Administrator ✅');
console.log('🔗 SSH Tunnel Configuration:');
console.log('   Remote: gocode.cl:9001');
console.log('   Local: localhost:8765');
console.log('   SSH Key: C:\\Users\\Mauro\\.ssh\\id_rsa');
console.log('🔧 Installing service...\n');

// Install the service
svc.install();