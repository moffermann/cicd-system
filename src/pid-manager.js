#!/usr/bin/env node
/**
 * PID Management Script
 * Manages process ID files to prevent port conflicts
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PID_FILE = join(__dirname, '../.cicd-system.pid');

class PidManager {
  static writePid(pid = process.pid) {
    try {
      writeFileSync(PID_FILE, pid.toString(), 'utf8');
      console.log(`📝 PID file written: ${pid}`);
    } catch (error) {
      console.error('❌ Failed to write PID file:', error.message);
    }
  }

  static readPid() {
    try {
      if (existsSync(PID_FILE)) {
        const pid = readFileSync(PID_FILE, 'utf8').trim();
        return parseInt(pid, 10);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to read PID file:', error.message);
      return null;
    }
  }

  static removePid() {
    try {
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
        console.log('🗑️ PID file removed');
      }
    } catch (error) {
      console.error('❌ Failed to remove PID file:', error.message);
    }
  }

  static async isProcessRunning(pid) {
    if (!pid) return false;
    
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}"`);
        return stdout.includes(pid.toString());
      } else {
        const { stdout } = await execAsync(`ps -p ${pid}`);
        return stdout.includes(pid.toString());
      }
    } catch (error) {
      return false;
    }
  }

  static async killProcess(pid) {
    if (!pid) return false;
    
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${pid} /F`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      console.log(`🔪 Process ${pid} killed`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to kill process ${pid}:`, error.message);
      return false;
    }
  }

  static async cleanup() {
    const pid = this.readPid();
    
    if (pid) {
      console.log(`🔍 Found PID file with process ${pid}`);
      const isRunning = await this.isProcessRunning(pid);
      
      if (isRunning) {
        console.log('⚠️ Process is still running, attempting to kill...');
        await this.killProcess(pid);
      } else {
        console.log('💀 Process is not running');
      }
      
      this.removePid();
    } else {
      console.log('✅ No PID file found, cleanup not needed');
    }
  }

  static async start() {
    // Clean up any existing processes
    await this.cleanup();
    
    // Write new PID
    this.writePid();
    
    // Set up cleanup on exit
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, cleaning up...');
      this.removePid();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, cleaning up...');
      this.removePid();
      process.exit(0);
    });
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'cleanup':
      PidManager.cleanup();
      break;
    case 'start':
      PidManager.start();
      break;
    case 'status':
      const pid = PidManager.readPid();
      if (pid) {
        PidManager.isProcessRunning(pid).then(running => {
          console.log(`📊 PID: ${pid}, Running: ${running ? '✅' : '❌'}`);
        });
      } else {
        console.log('❌ No PID file found');
      }
      break;
    default:
      console.log('Usage: node pid-manager.js [cleanup|start|status]');
  }
}

export default PidManager;