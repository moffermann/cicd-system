#!/usr/bin/env node

/**
 * Windows Service Installer for CI/CD Webhook Server
 * Uses the refactored WindowsServiceManager for better maintainability
 */

const path = require('path');
const WindowsServiceManager = require('../src/services/WindowsServiceManager.cjs');

async function main() {
  try {
    const serviceManager = new WindowsServiceManager({
      serviceName: 'CICD-Webhook-Server',
      serviceDescription: 'CI/CD Multi-Project Webhook Server - Auto-deployment system',
      scriptPath: path.join(__dirname, '..', 'src', 'webhook-server-service.cjs'),
      nodeOptions: ['--max_old_space_size=4096'],
      environment: [
        { name: "NODE_ENV", value: "production" },
        { name: "WEBHOOK_PORT", value: "8765" },
        { name: "DISABLE_NGROK", value: "true" }
      ]
    });

    const result = await serviceManager.install();
    console.log('\n✅ Installation completed successfully!');
    console.log(`Service: ${result.serviceName}`);
    
  } catch (error) {
    console.error('\n❌ Installation failed:', error.message);
    
    if (error.message.includes('Administrator')) {
      console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
      console.error('📋 Then run: node scripts/install-windows-service.cjs');
    }
    
    process.exit(1);
  }
}

// Run the installer
main();