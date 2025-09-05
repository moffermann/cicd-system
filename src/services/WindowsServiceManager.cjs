#!/usr/bin/env node

/**
 * Windows Service Manager
 * Handles installation, uninstallation, and management of Windows services
 */

const Service = require('node-windows').Service;
const path = require('path');
const { execSync } = require('child_process');

class WindowsServiceManager {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'CICD-Webhook-Server';
    this.serviceDescription = options.serviceDescription || 'CI/CD Multi-Project Webhook Server - Auto-deployment system';
    this.scriptPath = options.scriptPath || path.join(__dirname, '..', '..', 'src', 'webhook-server-service.cjs');
    this.nodeOptions = options.nodeOptions || ['--max_old_space_size=4096'];
    this.environment = options.environment || [
      { name: "NODE_ENV", value: "production" },
      { name: "WEBHOOK_PORT", value: "8765" },
      { name: "DISABLE_NGROK", value: "true" }
    ];
    this.service = null;
  }

  createService() {
    if (!this.service) {
      this.service = new Service({
        name: this.serviceName,
        description: this.serviceDescription,
        script: this.scriptPath,
        nodeOptions: this.nodeOptions,
        env: this.environment
      });
    }
    return this.service;
  }

  isAdministrator() {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  validateAdminPrivileges() {
    if (!this.isAdministrator()) {
      throw new Error('Administrator privileges required. Run as Administrator.');
    }
  }

  validateScriptPath() {
    const fs = require('fs');
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(`Service script not found: ${this.scriptPath}`);
    }
  }

  async install() {
    return new Promise((resolve, reject) => {
      try {
        this.validateAdminPrivileges();
        this.validateScriptPath();

        console.log('🔧 Installing CI/CD Webhook Server as Windows Service...\n');
        console.log('👤 Running as Administrator ✅');
        console.log(`📁 Script path: ${this.scriptPath}`);
        console.log('🔧 Installing service...\n');

        const service = this.createService();

        service.on('install', () => {
          console.log('✅ Windows Service installed successfully!');
          console.log(`🔧 Service Name: ${this.serviceName}`);
          console.log(`📁 Service Path: ${this.scriptPath}`);
          console.log('🚀 Starting service...');
          service.start();
        });

        service.on('start', () => {
          console.log('🎉 CI/CD Webhook Server service started successfully!');
          console.log('🌐 Local webhook URL: http://localhost:8765');
          console.log('🔗 Webhook endpoint: http://localhost:8765/webhook');
          console.log('📋 Health check: http://localhost:8765/health');
          console.log('');
          console.log('✅ Service will auto-start on Windows boot');
          console.log('🔧 Manage service via Windows Services (services.msc)');
          console.log('📝 Service logs available in Event Viewer');
          resolve({ success: true, serviceName: this.serviceName });
        });

        service.on('error', (error) => {
          console.error('❌ Service error:', error);
          reject(new Error(`Service installation failed: ${error.message}`));
        });

        service.install();
      } catch (error) {
        reject(error);
      }
    });
  }

  async uninstall() {
    return new Promise((resolve, reject) => {
      try {
        this.validateAdminPrivileges();

        console.log('🗑️ Uninstalling CI/CD Webhook Server Windows Service...\n');
        console.log('👤 Running as Administrator ✅');
        console.log('🛑 Stopping and uninstalling service...\n');

        const service = this.createService();

        service.on('uninstall', () => {
          console.log('✅ Windows Service uninstalled successfully!');
          console.log(`🔧 Service Name: ${this.serviceName}`);
          console.log('🗑️ Service completely removed from Windows Services');
          resolve({ success: true, serviceName: this.serviceName });
        });

        service.on('error', (error) => {
          console.error('❌ Service error:', error);
          reject(new Error(`Service uninstallation failed: ${error.message}`));
        });

        // Stop the service first if it's running
        try {
          service.stop();
          console.log('🛑 Service stopped');
        } catch (error) {
          console.log('⚠️ Service was not running');
        }

        service.uninstall();
      } catch (error) {
        reject(error);
      }
    });
  }

  getServiceStatus() {
    try {
      const result = execSync(`sc query "${this.serviceName}"`, { encoding: 'utf8' });
      
      if (result.includes('RUNNING')) {
        return { status: 'running', details: result };
      } else if (result.includes('STOPPED')) {
        return { status: 'stopped', details: result };
      } else {
        return { status: 'unknown', details: result };
      }
    } catch (error) {
      if (error.message.includes('not exist')) {
        return { status: 'not_installed', details: 'Service not installed' };
      }
      return { status: 'error', details: error.message };
    }
  }

  async startService() {
    try {
      this.validateAdminPrivileges();
      execSync(`sc start "${this.serviceName}"`, { stdio: 'inherit' });
      return { success: true, message: 'Service started successfully' };
    } catch (error) {
      throw new Error(`Failed to start service: ${error.message}`);
    }
  }

  async stopService() {
    try {
      this.validateAdminPrivileges();
      execSync(`sc stop "${this.serviceName}"`, { stdio: 'inherit' });
      return { success: true, message: 'Service stopped successfully' };
    } catch (error) {
      throw new Error(`Failed to stop service: ${error.message}`);
    }
  }
}

module.exports = WindowsServiceManager;