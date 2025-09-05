#!/usr/bin/env node

/**
 * SSH Tunnel Windows Service Uninstaller
 * Removes the SSH tunnel service completely
 */

const Service = require('node-windows').Service;
const path = require('path');

// Define the service (same configuration as installer)
const svc = new Service({
  name: 'CICD-SSH-Tunnel',
  description: 'CI/CD SSH Tunnel Service - Maintains persistent tunnel to gocode.cl for webhook notifications',
  script: path.join(__dirname, 'ssh-tunnel-service-wrapper.cjs')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('✅ SSH Tunnel Windows Service uninstalled successfully!');
  console.log('🔧 Service Name: CICD-SSH-Tunnel');
  console.log('🗑️ Service completely removed from Windows Services');
  console.log('');
  console.log('📝 Note: SSH tunnel is no longer automatically managed');
  console.log('💡 Use manual scripts if needed:');
  console.log('   - scripts/start-ssh-tunnel-service.ps1');
  console.log('   - scripts/keep-ssh-tunnel-alive.ps1');
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
console.log('🗑️ Uninstalling SSH Tunnel Windows Service...\n');

if (!isAdmin()) {
  console.error('❌ ERROR: This script must be run as Administrator');
  console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
  console.error('📋 Then run: node scripts/uninstall-ssh-tunnel-service.js');
  process.exit(1);
}

console.log('👤 Running as Administrator ✅');
console.log('🛑 Stopping and uninstalling SSH tunnel service...\n');

// Stop the service first if it's running
try {
  svc.stop();
  console.log('🛑 Service stopped');
} catch (e) {
  console.log('⚠️ Service was not running');
}

// Uninstall the service
svc.uninstall();