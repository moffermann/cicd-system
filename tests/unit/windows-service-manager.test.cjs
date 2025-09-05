/**
 * Unit tests for WindowsServiceManager
 */

const path = require('path');

// Create mock functions
const mockExecSync = jest.fn();
const mockExistsSync = jest.fn();

// Mock dependencies
jest.mock('child_process', () => ({
  execSync: mockExecSync
}));
jest.mock('fs', () => ({
  existsSync: mockExistsSync
}));

const mockService = {
  install: jest.fn(),
  uninstall: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn()
};

jest.mock('node-windows', () => ({
  Service: jest.fn(() => mockService)
}));

const WindowsServiceManager = require('../../src/services/WindowsServiceManager.cjs');

describe('WindowsServiceManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true by default
    mockExistsSync.mockReturnValue(true);
    
    // Mock execSync for admin check to return success
    mockExecSync.mockReturnValue('');

    manager = new WindowsServiceManager({
      serviceName: 'Test-Service',
      serviceDescription: 'Test service description',
      scriptPath: '/test/path/script.js'
    });
  });

  afterEach(() => {
    manager = null;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultManager = new WindowsServiceManager();
      expect(defaultManager.serviceName).toBe('CICD-Webhook-Server');
      expect(defaultManager.serviceDescription).toContain('CI/CD Multi-Project');
    });

    it('should initialize with custom options', () => {
      expect(manager.serviceName).toBe('Test-Service');
      expect(manager.serviceDescription).toBe('Test service description');
      expect(manager.scriptPath).toBe('/test/path/script.js');
    });
  });

  describe('isAdministrator', () => {
    it('should return true when running as administrator', () => {
      mockExecSync.mockReturnValue('');
      expect(manager.isAdministrator()).toBe(true);
    });

    it('should return false when not running as administrator', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });
      expect(manager.isAdministrator()).toBe(false);
    });
  });

  describe('validateAdminPrivileges', () => {
    it('should not throw when running as administrator', () => {
      mockExecSync.mockReturnValue('');
      expect(() => manager.validateAdminPrivileges()).not.toThrow();
    });

    it('should throw when not running as administrator', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });
      expect(() => manager.validateAdminPrivileges()).toThrow('Administrator privileges required');
    });
  });

  describe('validateScriptPath', () => {
    it('should not throw when script path exists', () => {
      mockExistsSync.mockReturnValue(true);
      expect(() => manager.validateScriptPath()).not.toThrow();
    });

    it('should throw when script path does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => manager.validateScriptPath()).toThrow('Service script not found');
    });
  });

  describe('createService', () => {
    it('should create and return a service instance', () => {
      const service = manager.createService();
      expect(require('node-windows').Service).toHaveBeenCalledWith({
        name: 'Test-Service',
        description: 'Test service description',
        script: '/test/path/script.js',
        nodeOptions: ['--max_old_space_size=4096'],
        env: expect.any(Array)
      });
      expect(service).toBe(mockService);
    });

    it('should reuse existing service instance', () => {
      const service1 = manager.createService();
      const service2 = manager.createService();
      expect(service1).toBe(service2);
      expect(require('node-windows').Service).toHaveBeenCalledTimes(1);
    });
  });

  describe('install', () => {
    it('should install service successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Simulate successful installation
      mockService.on.mockImplementation((event, callback) => {
        if (event === 'install') {
          setTimeout(() => callback(), 10);
        } else if (event === 'start') {
          setTimeout(() => callback(), 20);
        }
      });

      const result = await manager.install();
      
      expect(result).toEqual({
        success: true,
        serviceName: 'Test-Service'
      });
      expect(mockService.install).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should reject if not running as administrator', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(manager.install()).rejects.toThrow('Administrator privileges required');
    });

    it('should reject if script path does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(manager.install()).rejects.toThrow('Service script not found');
    });

    it('should reject on service error', async () => {
      mockService.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Installation failed')), 10);
        }
      });

      await expect(manager.install()).rejects.toThrow('Service installation failed');
    });
  });

  describe('uninstall', () => {
    it('should uninstall service successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Simulate successful uninstallation
      mockService.on.mockImplementation((event, callback) => {
        if (event === 'uninstall') {
          setTimeout(() => callback(), 10);
        }
      });

      const result = await manager.uninstall();
      
      expect(result).toEqual({
        success: true,
        serviceName: 'Test-Service'
      });
      expect(mockService.stop).toHaveBeenCalled();
      expect(mockService.uninstall).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should reject if not running as administrator', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(manager.uninstall()).rejects.toThrow('Administrator privileges required');
    });

    it('should reject on service error', async () => {
      mockService.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Uninstallation failed')), 10);
        }
      });

      await expect(manager.uninstall()).rejects.toThrow('Service uninstallation failed');
    });
  });

  describe('getServiceStatus', () => {
    it('should return running status', () => {
      mockExecSync.mockReturnValue('SERVICE_NAME: Test-Service\nSTATE: 4 RUNNING');
      
      const status = manager.getServiceStatus();
      
      expect(status.status).toBe('running');
      expect(status.details).toContain('RUNNING');
    });

    it('should return stopped status', () => {
      mockExecSync.mockReturnValue('SERVICE_NAME: Test-Service\nSTATE: 1 STOPPED');
      
      const status = manager.getServiceStatus();
      
      expect(status.status).toBe('stopped');
      expect(status.details).toContain('STOPPED');
    });

    it('should return not_installed status', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('not exist');
        error.message = 'The specified service does not exist';
        throw error;
      });
      
      const status = manager.getServiceStatus();
      
      expect(status.status).toBe('not_installed');
    });

    it('should return error status for other errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Unknown error');
      });
      
      const status = manager.getServiceStatus();
      
      expect(status.status).toBe('error');
      expect(status.details).toBe('Unknown error');
    });
  });

  describe('startService', () => {
    it('should start service successfully', async () => {
      mockExecSync.mockReturnValue('');
      
      const result = await manager.startService();
      
      expect(result).toEqual({
        success: true,
        message: 'Service started successfully'
      });
      expect(mockExecSync).toHaveBeenCalledWith('sc start "Test-Service"', { stdio: 'inherit' });
    });

    it('should throw error if not administrator', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(manager.startService()).rejects.toThrow('Failed to start service');
    });
  });

  describe('stopService', () => {
    it('should stop service successfully', async () => {
      mockExecSync.mockReturnValue('');
      
      const result = await manager.stopService();
      
      expect(result).toEqual({
        success: true,
        message: 'Service stopped successfully'
      });
      expect(mockExecSync).toHaveBeenCalledWith('sc stop "Test-Service"', { stdio: 'inherit' });
    });

    it('should throw error if not administrator', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(manager.stopService()).rejects.toThrow('Failed to stop service');
    });
  });
});