// Jest setup file
const path = require('path');
const fs = require('fs');

// Ensure fixtures directory exists
const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Global test timeout (longer for Windows service operations)
jest.setTimeout(15000);

// Mock console.log for cleaner test output (but allow console.error)
const originalLog = console.log;
console.log = jest.fn();

// Keep console.error for debugging
console.error = console.error;
console.warn = jest.fn();

// Global beforeEach to clean up any test artifacts
beforeEach(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.WEBHOOK_PORT = '8766'; // Different port for tests
  process.env.DISABLE_NGROK = 'true';
  
  // Clean up any test files in fixtures
  const testFiles = [
    path.join(fixturesDir, 'test.db'),
    path.join(fixturesDir, 'integration-test.db'),
    path.join(fixturesDir, 'test-config.json'),
    path.join(fixturesDir, 'package.json'),
    path.join(fixturesDir, 'cicd-config.example.json')
  ];

  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
  
  // Clean up any test logs
  const testLogsDir = path.join(__dirname, '..', 'test-logs');
  if (fs.existsSync(testLogsDir)) {
    try {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Global afterAll to clean up
afterAll(() => {
  // Restore console.log
  console.log = originalLog;
  
  // Clean up fixtures directory
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (fs.existsSync(fixturesDir)) {
    try {
      const files = fs.readdirSync(fixturesDir);
      files.forEach(file => {
        const filePath = path.join(fixturesDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Increase test timeout for integration tests
if (process.env.NODE_ENV === 'integration') {
  jest.setTimeout(30000);
}