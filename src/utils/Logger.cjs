/**
 * Simple Logger utility
 */
class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  log(message, color = 'reset') {
    const colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };

    const timestamp = new Date().toISOString();
    const coloredMessage = color !== 'reset' ? `${colors[color]}${message}${colors.reset}` : message;
    const prefixedMessage = this.prefix ? `[${this.prefix}] ${coloredMessage}` : coloredMessage;
    
    console.log(`${timestamp} - ${prefixedMessage}`);
  }

  info(message) { this.log(`ℹ️ ${message}`, 'blue'); }
  warn(message) { this.log(`⚠️ ${message}`, 'yellow'); }
  error(message) { this.log(`❌ ${message}`, 'red'); }
  success(message) { this.log(`✅ ${message}`, 'green'); }
  debug(message) { this.log(`🐛 ${message}`, 'cyan'); }
}

module.exports = Logger;