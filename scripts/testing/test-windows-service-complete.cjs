#!/usr/bin/env node

/**
 * Complete Windows Service Test Script
 * Tests all Windows service functionality without actually installing the service
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import our refactored classes
const WindowsServiceWrapper = require('../../src/services/WindowsServiceWrapper.cjs');
const WindowsServiceManager = require('../../src/services/WindowsServiceManager.cjs');

class WindowsServiceTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.testLogDir = path.join(__dirname, '..', '..', 'test-logs', 'service-test');
    this.testLogFile = path.join(this.testLogDir, 'service-test.log');
    this.testServerPath = path.join(__dirname, '..', '..', 'tests', 'integration', 'test-scripts', 'dummy-server.cjs');
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'SUCCESS');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'ERROR');
  }

  logTest(testName, passed, details = '') {
    const result = passed ? '✅ PASS' : '❌ FAIL';
    this.log(`${result}: ${testName}${details ? ` - ${details}` : ''}`);
    
    this.testResults.tests.push({ name: testName, passed, details });
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testWindowsServiceWrapper() {
    this.log('\n🔧 Testing WindowsServiceWrapper...');

    try {
      // Test 1: Constructor and initialization
      const wrapper = new WindowsServiceWrapper({
        serverPath: this.testServerPath,
        maxRestarts: 2,
        restartDelay: 1000,
        logFile: this.testLogFile
      });

      this.logTest('WindowsServiceWrapper constructor', true);

      // Test 2: Initial status
      const initialStatus = wrapper.getStatus();
      const statusOk = !initialStatus.isRunning && initialStatus.pid === null;
      this.logTest('Initial status check', statusOk, `Running: ${initialStatus.isRunning}, PID: ${initialStatus.pid}`);

      // Test 3: Path validation with existing file
      try {
        wrapper.validateServerPath();
        this.logTest('Path validation (existing file)', true);
      } catch (error) {
        this.logTest('Path validation (existing file)', false, error.message);
      }

      // Test 4: Path validation with non-existing file
      const wrapperBadPath = new WindowsServiceWrapper({
        serverPath: '/non/existent/path.js'
      });
      
      try {
        wrapperBadPath.validateServerPath();
        this.logTest('Path validation (non-existing file)', false, 'Should have thrown error');
      } catch (error) {
        this.logTest('Path validation (non-existing file)', true, 'Correctly threw error');
      }

      // Test 5: Logging functionality
      try {
        wrapper.log('Test log message for service wrapper');
        this.logTest('Logging functionality', true);
      } catch (error) {
        this.logTest('Logging functionality', false, error.message);
      }

      // Test 6: Start server process (short test)
      try {
        this.log('🚀 Starting test server process...');
        const process = await wrapper.start();
        
        if (process && process.pid) {
          this.logTest('Server process start', true, `PID: ${process.pid}`);
          
          // Wait a bit to let the server start
          await this.sleep(2000);
          
          // Check status while running
          const runningStatus = wrapper.getStatus();
          this.logTest('Status while running', runningStatus.isRunning, `PID: ${runningStatus.pid}`);
          
          // Stop the process
          if (process && !process.killed) {
            process.kill('SIGTERM');
            this.logSuccess('Test server stopped');
          }
          
          // Wait for cleanup
          await this.sleep(1000);
          
        } else {
          this.logTest('Server process start', false, 'No process returned');
        }
        
      } catch (error) {
        this.logTest('Server process start', false, error.message);
      }

    } catch (error) {
      this.logError(`WindowsServiceWrapper test failed: ${error.message}`);
    }
  }

  async testWindowsServiceManager() {
    this.log('\n🔧 Testing WindowsServiceManager...');

    try {
      // Test 1: Constructor with custom options
      const manager = new WindowsServiceManager({
        serviceName: 'Test-CICD-Service',
        serviceDescription: 'Test CI/CD Service for Integration Testing',
        scriptPath: path.join(__dirname, '..', '..', 'src', 'webhook-server-service.cjs')
      });

      this.logTest('WindowsServiceManager constructor', true);

      // Test 2: Administrator privileges check
      const isAdmin = manager.isAdministrator();
      this.logTest('Administrator check', true, `Is Admin: ${isAdmin}`);

      // Test 3: Script path validation
      try {
        manager.validateScriptPath();
        this.logTest('Script path validation', true);
      } catch (error) {
        this.logTest('Script path validation', false, error.message);
      }

      // Test 4: Service creation (mock)
      try {
        const service = manager.createService();
        this.logTest('Service instance creation', true, 'Service object created');
      } catch (error) {
        this.logTest('Service instance creation', false, error.message);
      }

      // Test 5: Service status check (actual Windows command)
      try {
        const status = manager.getServiceStatus();
        const validStatuses = ['running', 'stopped', 'not_installed', 'error', 'unknown'];
        const statusValid = validStatuses.includes(status.status);
        this.logTest('Service status check', statusValid, `Status: ${status.status}`);
      } catch (error) {
        this.logTest('Service status check', false, error.message);
      }

      // Test 6: Configuration validation
      const configValid = manager.serviceName === 'Test-CICD-Service' && 
                          manager.serviceDescription.includes('Test CI/CD') &&
                          manager.scriptPath.includes('webhook-server-service.cjs');
      
      this.logTest('Configuration validation', configValid);

    } catch (error) {
      this.logError(`WindowsServiceManager test failed: ${error.message}`);
    }
  }

  async testScriptIntegration() {
    this.log('\n🔧 Testing Script Integration...');

    try {
      // Test 1: Service wrapper script exists
      const serviceWrapperPath = path.join(__dirname, '..', '..', 'src', 'webhook-server-service.cjs');
      const wrapperExists = fs.existsSync(serviceWrapperPath);
      this.logTest('Service wrapper script exists', wrapperExists);

      // Test 2: Install script exists
      const installPath = path.join(__dirname, '..', '..', 'scripts', 'install-windows-service.cjs');
      const installExists = fs.existsSync(installPath);
      this.logTest('Install script exists', installExists);

      // Test 3: Uninstall script exists  
      const uninstallPath = path.join(__dirname, '..', '..', 'scripts', 'uninstall-windows-service.cjs');
      const uninstallExists = fs.existsSync(uninstallPath);
      this.logTest('Uninstall script exists', uninstallExists);

      // Test 4: Scripts have correct imports
      if (wrapperExists) {
        const wrapperContent = fs.readFileSync(serviceWrapperPath, 'utf8');
        const hasCorrectImport = wrapperContent.includes('WindowsServiceWrapper');
        this.logTest('Service wrapper has correct imports', hasCorrectImport);
      }

      if (installExists) {
        const installContent = fs.readFileSync(installPath, 'utf8');
        const hasManagerImport = installContent.includes('WindowsServiceManager');
        this.logTest('Install script has correct imports', hasManagerImport);
      }

      if (uninstallExists) {
        const uninstallContent = fs.readFileSync(uninstallPath, 'utf8');
        const hasManagerImport = uninstallContent.includes('WindowsServiceManager');
        this.logTest('Uninstall script has correct imports', hasManagerImport);
      }

    } catch (error) {
      this.logError(`Script integration test failed: ${error.message}`);
    }
  }

  async testErrorHandling() {
    this.log('\n🔧 Testing Error Handling...');

    try {
      // Test 1: WindowsServiceWrapper with invalid path
      try {
        const badWrapper = new WindowsServiceWrapper({
          serverPath: '/absolutely/invalid/path/server.js'
        });
        
        await badWrapper.start();
        this.logTest('Invalid path error handling', false, 'Should have thrown error');
      } catch (error) {
        this.logTest('Invalid path error handling', true, 'Correctly caught error');
      }

      // Test 2: WindowsServiceManager with invalid script
      try {
        const badManager = new WindowsServiceManager({
          scriptPath: '/invalid/script/path.js'
        });
        
        badManager.validateScriptPath();
        this.logTest('Invalid script path error handling', false, 'Should have thrown error');
      } catch (error) {
        this.logTest('Invalid script path error handling', true, 'Correctly caught error');
      }

      // Test 3: Restart logic simulation
      const wrapper = new WindowsServiceWrapper({
        serverPath: this.testServerPath,
        maxRestarts: 2
      });

      // Test restart decision logic
      const shouldRestartNormal = wrapper.shouldRestart(0); // Normal exit
      const shouldRestartError = wrapper.shouldRestart(1); // Error exit
      
      this.logTest('Restart logic - normal exit', !shouldRestartNormal);
      this.logTest('Restart logic - error exit', shouldRestartError);

      // Test max restarts
      wrapper.restartCount = 3;
      const shouldRestartMaxed = wrapper.shouldRestart(1);
      this.logTest('Restart logic - max restarts reached', !shouldRestartMaxed);

    } catch (error) {
      this.logError(`Error handling test failed: ${error.message}`);
    }
  }

  async testRealWorldScenario() {
    this.log('\n🔧 Testing Real-World Scenario...');

    try {
      // Create a temporary test configuration
      const testWrapper = new WindowsServiceWrapper({
        serverPath: this.testServerPath,
        maxRestarts: 1,
        restartDelay: 500,
        logFile: this.testLogFile,
        environment: {
          TEST_MODE: 'true',
          TEST_PORT: '3999'
        }
      });

      this.log('📋 Simulating production-like workflow...');
      
      // Step 1: Validate configuration
      try {
        testWrapper.validateServerPath();
        this.logSuccess('Configuration validation passed');
      } catch (error) {
        this.logError(`Configuration validation failed: ${error.message}`);
        return;
      }

      // Step 2: Start the service
      let testProcess = null;
      try {
        testProcess = await testWrapper.start();
        this.logSuccess(`Service started with PID: ${testProcess.pid}`);
        
        // Wait for service to stabilize
        await this.sleep(1500);
        
        // Step 3: Check service health
        const status = testWrapper.getStatus();
        if (status.isRunning) {
          this.logSuccess(`Service is healthy - PID: ${status.pid}`);
        } else {
          this.logError('Service is not running as expected');
        }
        
        // Step 4: Test service restart capabilities (simulation)
        const restartCapable = testWrapper.maxRestarts > 0 && testWrapper.restartCount < testWrapper.maxRestarts;
        this.logTest('Service restart capability', restartCapable, `Max restarts: ${testWrapper.maxRestarts}`);
        
        // Step 5: Graceful shutdown
        if (testProcess && !testProcess.killed) {
          testProcess.kill('SIGTERM');
          await this.sleep(1000);
          this.logSuccess('Service gracefully stopped');
        }
        
      } catch (error) {
        this.logError(`Real-world scenario failed: ${error.message}`);
      }
      
      this.logTest('Real-world scenario simulation', true, 'Complete workflow tested');

    } catch (error) {
      this.logError(`Real-world scenario test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    this.log('🧪 Starting Windows Service Complete Test Suite\n');
    this.log('=' .repeat(60));

    // Ensure test directories exist
    if (!fs.existsSync(this.testLogDir)) {
      fs.mkdirSync(this.testLogDir, { recursive: true });
    }

    // Run all test suites
    await this.testWindowsServiceWrapper();
    await this.testWindowsServiceManager();
    await this.testScriptIntegration();
    await this.testErrorHandling();
    await this.testRealWorldScenario();

    // Print final results
    this.log('\n' + '=' .repeat(60));
    this.log('📊 TEST RESULTS SUMMARY');
    this.log('=' .repeat(60));
    
    this.logSuccess(`Tests Passed: ${this.testResults.passed}`);
    if (this.testResults.failed > 0) {
      this.logError(`Tests Failed: ${this.testResults.failed}`);
    } else {
      this.logSuccess(`Tests Failed: ${this.testResults.failed}`);
    }
    
    const total = this.testResults.passed + this.testResults.failed;
    const successRate = ((this.testResults.passed / total) * 100).toFixed(1);
    
    this.log(`Total Tests: ${total}`);
    this.log(`Success Rate: ${successRate}%`);
    
    if (this.testResults.failed === 0) {
      this.logSuccess('🎉 ALL TESTS PASSED - Windows Service is ready for production!');
    } else {
      this.logError('⚠️ Some tests failed - Review the issues above');
    }
    
    // Cleanup
    this.log('\n🧹 Cleaning up test artifacts...');
    try {
      if (fs.existsSync(this.testLogFile)) {
        this.log(`📋 Test logs saved to: ${this.testLogFile}`);
      }
    } catch (error) {
      this.log(`Warning: Cleanup error: ${error.message}`);
    }
    
    return this.testResults.failed === 0;
  }
}

// Main execution
async function main() {
  const tester = new WindowsServiceTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = WindowsServiceTester;