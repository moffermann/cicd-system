#!/usr/bin/env node

/**
 * CommonJS wrapper for webhook-server-multi.js
 * This file is used by Windows Service to avoid ES modules issues
 * Uses the refactored WindowsServiceWrapper for better reliability
 */

const path = require('path');
const WindowsServiceWrapper = require('./services/WindowsServiceWrapper.cjs');

// Create wrapper instance with production configuration
const wrapper = new WindowsServiceWrapper({
  serverPath: path.join(__dirname, 'webhook-server-multi.js'),
  nodeOptions: ['--max_old_space_size=4096'],
  environment: {
    NODE_ENV: 'production',
    WEBHOOK_PORT: '8765',
    DISABLE_NGROK: 'true'
  },
  maxRestarts: 5,
  restartDelay: 5000,
  logFile: path.join(process.cwd(), 'logs', 'webhook-service.log')
});

// Start the service
wrapper.start().catch((error) => {
  console.error('❌ Failed to start Windows service:', error);
  process.exit(1);
});