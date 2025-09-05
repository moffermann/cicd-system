#!/usr/bin/env node

/**
 * Windows Service Wrapper for CI/CD Webhook Server
 * Provides robust process management and error handling
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class WindowsServiceWrapper {
  constructor(options = {}) {
    this.serverPath = options.serverPath || path.join(__dirname, '..', 'webhook-server-multi.js');
    this.nodeOptions = options.nodeOptions || [];
    this.environment = options.environment || {};
    this.serverProcess = null;
    this.isShuttingDown = false;
    this.restartCount = 0;
    this.maxRestarts = options.maxRestarts || 5;
    this.restartDelay = options.restartDelay || 5000;
    this.logFile = options.logFile || path.join(process.cwd(), 'logs', 'service.log');
    
    this.setupLogging();
    this.setupSignalHandlers();
  }

  setupLogging() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logMessage);
    
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  validateServerPath() {
    if (!fs.existsSync(this.serverPath)) {
      throw new Error(`Server script not found: ${this.serverPath}`);
    }
  }

  async start() {
    try {
      this.validateServerPath();
      this.log('🔧 Starting CI/CD Webhook Server via Windows Service...');
      this.log(`📁 Server path: ${this.serverPath}`);

      const env = {
        ...process.env,
        NODE_ENV: 'production',
        WEBHOOK_PORT: '8765',
        DISABLE_NGROK: 'true',
        ...this.environment
      };

      const args = [...this.nodeOptions, this.serverPath];

      this.serverProcess = spawn('node', args, {
        stdio: 'inherit',
        env
      });

      this.setupProcessHandlers();
      this.log('🎉 Windows Service wrapper started successfully');
      
      return this.serverProcess;
    } catch (error) {
      this.log(`❌ Failed to start server: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  setupProcessHandlers() {
    if (!this.serverProcess) return;

    this.serverProcess.on('close', (code) => {
      this.log(`🛑 Webhook server process exited with code ${code}`);
      
      if (!this.isShuttingDown && this.shouldRestart(code)) {
        this.attemptRestart();
      } else {
        process.exit(code);
      }
    });

    this.serverProcess.on('error', (error) => {
      this.log(`❌ Server process error: ${error.message}`, 'ERROR');
      
      if (!this.isShuttingDown && this.restartCount < this.maxRestarts) {
        this.attemptRestart();
      } else {
        process.exit(1);
      }
    });

    this.serverProcess.on('spawn', () => {
      this.log('✅ Server process spawned successfully');
      this.restartCount = 0; // Reset restart count on successful spawn
    });
  }

  shouldRestart(exitCode) {
    // Don't restart on normal exit codes
    const normalExitCodes = [0, 2, 130]; // 0=success, 2=misuse, 130=SIGINT
    return !normalExitCodes.includes(exitCode) && this.restartCount < this.maxRestarts;
  }

  async attemptRestart() {
    this.restartCount++;
    this.log(`🔄 Attempting restart ${this.restartCount}/${this.maxRestarts} in ${this.restartDelay}ms...`);
    
    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.start().catch((error) => {
          this.log(`❌ Restart attempt failed: ${error.message}`, 'ERROR');
          if (this.restartCount >= this.maxRestarts) {
            this.log('🛑 Maximum restart attempts reached. Shutting down.', 'ERROR');
            process.exit(1);
          }
        });
      }
    }, this.restartDelay);
  }

  setupSignalHandlers() {
    const gracefulShutdown = (signal) => {
      this.log(`📡 Received ${signal}, initiating graceful shutdown...`);
      this.isShuttingDown = true;
      
      if (this.serverProcess && !this.serverProcess.killed) {
        this.log('🛑 Stopping webhook server...');
        this.serverProcess.kill(signal);
        
        // Force kill after timeout
        setTimeout(() => {
          if (!this.serverProcess.killed) {
            this.log('⚠️ Force killing unresponsive process', 'WARN');
            this.serverProcess.kill('SIGKILL');
          }
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
  }

  getStatus() {
    return {
      isRunning: this.serverProcess ? !this.serverProcess.killed : false,
      pid: this.serverProcess ? this.serverProcess.pid : null,
      restartCount: this.restartCount,
      isShuttingDown: this.isShuttingDown,
      serverPath: this.serverPath
    };
  }
}

module.exports = WindowsServiceWrapper;

// If this script is run directly, start the service
if (require.main === module) {
  const wrapper = new WindowsServiceWrapper();
  
  wrapper.start().catch((error) => {
    console.error('❌ Failed to start Windows service:', error);
    process.exit(1);
  });
}