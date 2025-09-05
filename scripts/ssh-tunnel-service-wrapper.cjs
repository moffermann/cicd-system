#!/usr/bin/env node

/**
 * SSH Tunnel Service Wrapper
 * Maintains persistent SSH tunnel for CI/CD notifications
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

class SSHTunnelService {
  constructor() {
    this.tunnelPort = process.env.TUNNEL_PORT || '9001';
    this.localPort = process.env.LOCAL_PORT || '8765';
    this.remoteHost = process.env.REMOTE_HOST || 'ubuntu@gocode.cl';
    this.sshKeyPath = process.env.SSH_KEY_PATH || 'C:\\Users\\Mauro\\.ssh\\id_rsa';
    this.checkInterval = parseInt(process.env.CHECK_INTERVAL || '30') * 1000; // Convert to ms
    
    this.sshProcess = null;
    this.isRunning = false;
    this.restartCount = 0;
    
    // Service name for logging
    this.serviceName = 'CICD-SSH-Tunnel';
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`[${this.serviceName}] [${timestamp}] ${emoji} ${message}`);
  }

  async startTunnel() {
    try {
      this.log('Starting SSH tunnel...', 'info');
      
      // SSH command arguments
      const sshArgs = [
        '-N',  // No remote command
        '-R', `${this.tunnelPort}:localhost:${this.localPort}`,  // Reverse tunnel
        '-i', this.sshKeyPath,  // SSH key
        '-o', 'ServerAliveInterval=60',  // Keep alive
        '-o', 'ServerAliveCountMax=3',   // Max retries
        '-o', 'StrictHostKeyChecking=no', // Skip host key verification
        '-o', 'UserKnownHostsFile=NUL',   // Don't update known hosts
        '-o', 'LogLevel=ERROR',           // Reduce SSH verbosity
        this.remoteHost
      ];

      // Verify SSH key exists
      if (!fs.existsSync(this.sshKeyPath)) {
        throw new Error(`SSH key not found: ${this.sshKeyPath}`);
      }

      // Start SSH process
      this.sshProcess = spawn('ssh', sshArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      // Handle process events
      this.sshProcess.on('error', (error) => {
        this.log(`SSH process error: ${error.message}`, 'error');
        this.handleTunnelFailure();
      });

      this.sshProcess.on('exit', (code, signal) => {
        this.log(`SSH process exited with code ${code}, signal ${signal}`, 'warning');
        this.sshProcess = null;
        this.handleTunnelFailure();
      });

      this.sshProcess.stdout.on('data', (data) => {
        this.log(`SSH stdout: ${data.toString().trim()}`, 'info');
      });

      this.sshProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message && !message.includes('Warning')) {
          this.log(`SSH stderr: ${message}`, 'warning');
        }
      });

      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (this.sshProcess && this.sshProcess.pid) {
        this.isRunning = true;
        this.log(`SSH tunnel established successfully (PID: ${this.sshProcess.pid})`, 'success');
        this.log(`Tunnel: ${this.remoteHost}:${this.tunnelPort} ← localhost:${this.localPort}`, 'success');
        return true;
      } else {
        throw new Error('SSH process failed to start');
      }

    } catch (error) {
      this.log(`Failed to start SSH tunnel: ${error.message}`, 'error');
      this.handleTunnelFailure();
      return false;
    }
  }

  stopTunnel() {
    if (this.sshProcess && this.sshProcess.pid) {
      this.log(`Stopping SSH tunnel (PID: ${this.sshProcess.pid})`, 'info');
      this.sshProcess.kill('SIGTERM');
      this.sshProcess = null;
    }
    this.isRunning = false;
  }

  async testLocalWebhookServer() {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: this.localPort,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  async handleTunnelFailure() {
    this.isRunning = false;
    this.restartCount++;
    
    const backoffDelay = Math.min(30000, 5000 * this.restartCount); // Max 30s backoff
    this.log(`Tunnel failure #${this.restartCount}. Restarting in ${backoffDelay/1000}s...`, 'warning');
    
    setTimeout(async () => {
      if (!this.isRunning) {
        await this.startTunnel();
      }
    }, backoffDelay);
  }

  async monitorTunnel() {
    this.log('Starting tunnel monitoring...', 'info');
    
    while (true) {
      try {
        // Check if SSH process is still running
        if (!this.sshProcess || this.sshProcess.exitCode !== null) {
          this.log('SSH process not running, restarting...', 'warning');
          await this.startTunnel();
        } else {
          // Test local webhook server connectivity
          const webhookOnline = await this.testLocalWebhookServer();
          if (webhookOnline) {
            this.log('Tunnel healthy - local webhook server reachable', 'success');
            this.restartCount = 0; // Reset restart counter on success
          } else {
            this.log('Local webhook server not reachable (normal if not running)', 'info');
          }
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));

      } catch (error) {
        this.log(`Monitor error: ${error.message}`, 'error');
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }
  }

  async start() {
    this.log(`Starting SSH Tunnel Service`, 'info');
    this.log(`Configuration:`, 'info');
    this.log(`  Remote: ${this.remoteHost}:${this.tunnelPort}`, 'info');
    this.log(`  Local: localhost:${this.localPort}`, 'info');
    this.log(`  SSH Key: ${this.sshKeyPath}`, 'info');
    this.log(`  Check Interval: ${this.checkInterval/1000}s`, 'info');

    // Start initial tunnel
    await this.startTunnel();

    // Start monitoring loop
    this.monitorTunnel();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down...', 'info');
      this.stopTunnel();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down...', 'info');
      this.stopTunnel();
      process.exit(0);
    });
  }
}

// Start the service
const tunnelService = new SSHTunnelService();
tunnelService.start().catch(error => {
  console.error('Failed to start SSH tunnel service:', error);
  process.exit(1);
});