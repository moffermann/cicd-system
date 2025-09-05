#!/usr/bin/env node

/**
 * Windows Service Uninstaller for CI/CD Webhook Server
 * Uses the refactored WindowsServiceManager for better maintainability
 */

const WindowsServiceManager = require('../src/services/WindowsServiceManager.cjs');

async function main() {
  try {
    const serviceManager = new WindowsServiceManager({
      serviceName: 'CICD-Webhook-Server'
    });

    const result = await serviceManager.uninstall();
    console.log('\n✅ Uninstallation completed successfully!');
    console.log(`Service: ${result.serviceName}`);
    
  } catch (error) {
    console.error('\n❌ Uninstallation failed:', error.message);
    
    if (error.message.includes('Administrator')) {
      console.error('📋 Right-click Command Prompt and select "Run as Administrator"');
      console.error('📋 Then run: node scripts/uninstall-windows-service.cjs');
    }
    
    process.exit(1);
  }
}

// Run the uninstaller
main();