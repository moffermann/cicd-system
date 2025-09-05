#!/usr/bin/env node

/**
 * Dummy server for testing purposes
 * This script simulates a basic server that can be started and stopped
 */

const http = require('http');

const port = process.env.TEST_PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Test server running',
    timestamp: new Date().toISOString(),
    pid: process.pid
  }));
});

server.listen(port, () => {
  console.log(`Test server running on port ${port} (PID: ${process.pid})`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});

// Keep the process running
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});