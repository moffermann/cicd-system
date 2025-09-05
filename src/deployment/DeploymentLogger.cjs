/**
 * DeploymentLogger - Centralized logging for deployment processes
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class DeploymentLogger {
  constructor(deploymentId = null, dbLogger = null) {
    this.deploymentId = deploymentId;
    this.dbLogger = dbLogger;
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    const coloredMessage = `${colors[color]}${message}${colors.reset}`;
    console.log(`[${timestamp}] ${coloredMessage}`);
    
    // Log to database if available
    if (this.dbLogger && this.deploymentId) {
      const level = color === 'red' ? 'error' : color === 'yellow' ? 'warn' : 'info';
      this.dbLogger.addDeploymentLog(this.deploymentId, 'deployment', level, message);
    }
  }

  logSuccess(message) { 
    this.log(`✅ ${message}`, 'green'); 
  }

  logError(message) { 
    this.log(`❌ ${message}`, 'red'); 
  }

  logWarning(message) { 
    this.log(`⚠️ ${message}`, 'yellow'); 
  }

  logInfo(message) { 
    this.log(`ℹ️ ${message}`, 'blue'); 
  }

  logProgress(message) { 
    this.log(`🔄 ${message}`, 'cyan'); 
  }

  logPhase(phase, message) {
    this.log(`\n🚀 ===== ${phase.toUpperCase()} =====`, 'magenta');
    this.log(message, 'cyan');
    this.log('=' * 50, 'magenta');
  }

  getDuration() {
    return Date.now() - this.startTime;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

module.exports = DeploymentLogger;