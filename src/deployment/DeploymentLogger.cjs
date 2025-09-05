/**
 * Enhanced DeploymentLogger - Centralized logging for deployment processes
 */

const fs = require('fs');

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
    this.logs = [];
  }

  log(message, color = 'reset', level = 'INFO') {
    const timestamp = new Date().toISOString();
    const coloredMessage = `${colors[color]}${message}${colors.reset}`;
    console.log(`[${timestamp}] ${coloredMessage}`);
    
    // Store log entry
    const logEntry = {
      timestamp,
      level,
      message,
      deploymentId: this.deploymentId
    };
    this.logs.push(logEntry);
    
    // Log to database if available
    if (this.dbLogger && this.deploymentId) {
      const dbLevel = color === 'red' ? 'error' : color === 'yellow' ? 'warn' : 'info';
      this.dbLogger.addDeploymentLog(this.deploymentId, 'deployment', dbLevel, message);
    }
  }

  logSuccess(message) { 
    this.log(`✅ ${message}`, 'green', 'SUCCESS'); 
  }

  logError(message) { 
    this.log(`❌ ${message}`, 'red', 'ERROR'); 
  }

  logWarning(message) { 
    this.log(`⚠️ ${message}`, 'yellow', 'WARNING'); 
  }

  logInfo(message) { 
    this.log(`ℹ️ ${message}`, 'blue', 'INFO'); 
  }

  logProgress(message) { 
    this.log(`🔄 ${message}`, 'cyan', 'PROGRESS'); 
  }

  logPhase(phase, message) {
    this.log(`\n🚀 ===== ${phase.toUpperCase()} =====`, 'magenta', 'PHASE');
    this.log(message, 'cyan', 'INFO');
    this.log('='.repeat(50), 'magenta', 'PHASE');
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

  getLogs() {
    return [...this.logs];
  }

  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  generateReport() {
    const duration = this.getDuration();
    const errorCount = this.getLogsByLevel('ERROR').length;
    const warningCount = this.getLogsByLevel('WARNING').length;
    const successCount = this.getLogsByLevel('SUCCESS').length;

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 DEPLOYMENT REPORT - ${this.deploymentId}`);
    console.log('='.repeat(60));
    console.log(`⏱️ Duration: ${this.formatDuration(duration)}`);
    console.log(`✅ Successful operations: ${successCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total logs: ${this.logs.length}`);
    console.log('='.repeat(60));

    return {
      deploymentId: this.deploymentId,
      duration,
      errorCount,
      warningCount,
      successCount,
      totalLogs: this.logs.length
    };
  }

  saveLogsToFile(filePath) {
    try {
      const logData = {
        deploymentId: this.deploymentId,
        startTime: this.startTime,
        duration: this.getDuration(),
        logs: this.logs
      };

      fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
      this.logSuccess(`Logs saved to ${filePath}`);
    } catch (error) {
      this.logError(`Failed to save logs: ${error.message}`);
    }
  }
}

module.exports = DeploymentLogger;