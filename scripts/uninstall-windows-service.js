#!/usr/bin/env node

/**
 * Windows Service Uninstaller for CI/CD Webhook Server
 * Removes the Windows service completely
 */

const Service = require('node-windows').Service;
const path = require('path');

// Define the service (same configuration as installer)
const svc = new Service({
  name: 'CICD-Webhook-Server',
  description: 'CI/CD Multi-Project Webhook Server - Auto-deployment system',
  script: path.join(__dirname, '..', 'src', 'webhook-server-multi.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('✅ Windows Service uninstalled successfully!');
  console.log('🔧 Service Name: CICD-Webhook-Server');
  console.log('🗑️ Service completely removed from Windows Services');
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
console.log('🗑️ Uninstalling CI/CD Webhook Server Windows Service...\n');

if (!isAdmin()) {
  console.error('❌ ERROR: This script must be run as Administrator');
  console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
  console.error('📋 Then run: node scripts/uninstall-windows-service.js');
  process.exit(1);
}

console.log('👤 Running as Administrator ✅');
console.log('🛑 Stopping and uninstalling service...\n');

// Stop the service first if it's running
try {
  svc.stop();
  console.log('🛑 Service stopped');
} catch (e) {
  console.log('⚠️ Service was not running');
}

// Uninstall the service
svc.uninstall();