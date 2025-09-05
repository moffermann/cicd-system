/**
 * Unit tests for WindowsServiceWrapper
 */

const path = require('path');

// Create mock functions
const mockSpawn = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockAppendFileSync = jest.fn();

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Mock fs operations  
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  appendFileSync: mockAppendFileSync
}));

// Import after mocking
const WindowsServiceWrapper = require('../../src/services/WindowsServiceWrapper.cjs');

describe('WindowsServiceWrapper', () => {
  let wrapper;
  let mockProcess;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock process object
    mockProcess = {
      pid: 1234,
      killed: false,
      kill: jest.fn(),
      on: jest.fn()
    };

    // Mock spawn to return our mock process
    mockSpawn.mockReturnValue(mockProcess);
    
    // Mock fs operations
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockReturnValue(true);
    mockAppendFileSync.mockReturnValue(true);

    wrapper = new WindowsServiceWrapper({
      serverPath: '/test/server.js',
      maxRestarts: 3,
      restartDelay: 1000,
      logFile: '/test/logs/service.log'
    });
  });

  afterEach(() => {
    wrapper = null;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultWrapper = new WindowsServiceWrapper();
      expect(defaultWrapper.maxRestarts).toBe(5);
      expect(defaultWrapper.restartDelay).toBe(5000);
    });

    it('should initialize with custom options', () => {
      expect(wrapper.maxRestarts).toBe(3);
      expect(wrapper.restartDelay).toBe(1000);
      expect(wrapper.serverPath).toBe('/test/server.js');
    });

    it('should create log directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      new WindowsServiceWrapper({ logFile: '/test/logs/service.log' });
      expect(mockMkdirSync).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });
  });

  describe('validateServerPath', () => {
    it('should not throw if server path exists', () => {
      mockExistsSync.mockReturnValue(true);
      expect(() => wrapper.validateServerPath()).not.toThrow();
    });

    it('should throw if server path does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => wrapper.validateServerPath()).toThrow('Server script not found');
    });
  });

  describe('log', () => {
    it('should log to console and file', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      wrapper.log('Test message');
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockAppendFileSync).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle file write errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('File write error');
      });
      
      wrapper.log('Test message');
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to write to log file:', 'File write error');
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('start', () => {
    it('should start the server process successfully', async () => {
      const process = await wrapper.start();
      
      expect(mockSpawn).toHaveBeenCalledWith('node', ['/test/server.js'], {
        stdio: 'inherit',
        env: expect.objectContaining({
          NODE_ENV: 'production',
          WEBHOOK_PORT: '8765',
          DISABLE_NGROK: 'true'
        })
      });
      
      expect(process).toBe(mockProcess);
    });

    it('should throw error if server path does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await expect(wrapper.start()).rejects.toThrow('Server script not found');
    });

    it('should include custom environment variables', async () => {
      wrapper.environment = { CUSTOM_VAR: 'test' };
      
      await wrapper.start();
      
      expect(mockSpawn).toHaveBeenCalledWith('node', ['/test/server.js'], {
        stdio: 'inherit',
        env: expect.objectContaining({
          CUSTOM_VAR: 'test'
        })
      });
    });
  });

  describe('shouldRestart', () => {
    it('should return false for normal exit codes', () => {
      expect(wrapper.shouldRestart(0)).toBe(false);
      expect(wrapper.shouldRestart(2)).toBe(false);
      expect(wrapper.shouldRestart(130)).toBe(false);
    });

    it('should return true for abnormal exit codes', () => {
      expect(wrapper.shouldRestart(1)).toBe(true);
      expect(wrapper.shouldRestart(3)).toBe(true);
    });

    it('should return false if max restarts reached', () => {
      wrapper.restartCount = 3;
      expect(wrapper.shouldRestart(1)).toBe(false);
    });
  });

  describe('setupProcessHandlers', () => {
    it('should set up process event handlers', async () => {
      await wrapper.start();
      
      expect(mockProcess.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('spawn', expect.any(Function));
    });
  });

  describe('getStatus', () => {
    it('should return correct status when process is running', async () => {
      await wrapper.start();
      
      const status = wrapper.getStatus();
      
      expect(status).toEqual({
        isRunning: true,
        pid: 1234,
        restartCount: 0,
        isShuttingDown: false,
        serverPath: '/test/server.js'
      });
    });

    it('should return correct status when process is not running', () => {
      const status = wrapper.getStatus();
      
      expect(status).toEqual({
        isRunning: false,
        pid: null,
        restartCount: 0,
        isShuttingDown: false,
        serverPath: '/test/server.js'
      });
    });
  });

  describe('process event handling', () => {
    let closeHandler, errorHandler, spawnHandler;

    beforeEach(async () => {
      await wrapper.start();
      
      // Get the event handlers
      const onCalls = mockProcess.on.mock.calls;
      closeHandler = onCalls.find(call => call[0] === 'close')[1];
      errorHandler = onCalls.find(call => call[0] === 'error')[1];
      spawnHandler = onCalls.find(call => call[0] === 'spawn')[1];
    });

    it('should handle successful spawn', () => {
      spawnHandler();
      
      expect(wrapper.restartCount).toBe(0);
    });

    it('should handle normal close without restart', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      closeHandler(0); // Normal exit
      
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      exitSpy.mockRestore();
    });

    it('should handle abnormal close with restart attempt', () => {
      jest.spyOn(wrapper, 'attemptRestart').mockImplementation();
      
      closeHandler(1); // Abnormal exit
      
      expect(wrapper.attemptRestart).toHaveBeenCalled();
    });

    it('should handle error with restart attempt', () => {
      jest.spyOn(wrapper, 'attemptRestart').mockImplementation();
      
      errorHandler(new Error('Test error'));
      
      expect(wrapper.attemptRestart).toHaveBeenCalled();
    });
  });

  describe('signal handling', () => {
    it('should set up signal handlers', () => {
      const onSpy = jest.spyOn(process, 'on');
      
      new WindowsServiceWrapper();
      
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGHUP', expect.any(Function));
      
      onSpy.mockRestore();
    });
  });
});