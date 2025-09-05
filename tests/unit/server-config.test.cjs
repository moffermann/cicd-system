const ServerConfig = require('../../src/server/ServerConfig.cjs');
const fs = require('fs').promises;
const path = require('path');

// Mock fs.promises
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

describe('ServerConfig', () => {
    let serverConfig;
    let consoleSpy;

    beforeEach(() => {
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation()
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with default configuration', () => {
            serverConfig = new ServerConfig();
            
            expect(serverConfig.configPath).toContain('webhook-config.json');
            expect(serverConfig.config.port).toBe(process.env.WEBHOOK_PORT || 8765);
            expect(serverConfig.config.enabledFeatures.admin).toBe(false);
            expect(serverConfig.config.enabledFeatures.monitoring).toBe(true);
            expect(serverConfig.config.enabledFeatures.logging).toBe(true);
        });

        test('should accept custom config path', () => {
            const customPath = '/custom/webhook-config.json';
            serverConfig = new ServerConfig(customPath);
            
            expect(serverConfig.configPath).toBe(customPath);
        });
    });

    describe('load()', () => {
        beforeEach(() => {
            serverConfig = new ServerConfig();
        });

        test('should load configuration from file successfully', async () => {
            const configData = {
                adminToken: 'test-token',
                port: 9000,
                enabledFeatures: {
                    admin: true,
                    logging: false
                }
            };

            fs.readFile.mockResolvedValue(JSON.stringify(configData));

            const result = await serverConfig.load();

            expect(fs.readFile).toHaveBeenCalledWith(serverConfig.configPath, 'utf8');
            expect(result.adminToken).toBe('test-token');
            expect(result.port).toBe(9000);
            expect(result.enabledFeatures.admin).toBe(true);
            expect(result.enabledFeatures.monitoring).toBe(true); // Default preserved
            expect(result.enabledFeatures.logging).toBe(false); // Overridden
            expect(consoleSpy.log).toHaveBeenCalledWith('✅ Webhook configuration loaded');
        });

        test('should enable admin feature when adminToken is provided', async () => {
            const configData = {
                adminToken: 'secret-token',
                enabledFeatures: {
                    admin: false // Should be overridden to true
                }
            };

            fs.readFile.mockResolvedValue(JSON.stringify(configData));

            const result = await serverConfig.load();

            expect(result.enabledFeatures.admin).toBe(true);
        });

        test('should use defaults when config file does not exist', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

            const result = await serverConfig.load();

            expect(result.port).toBe(process.env.WEBHOOK_PORT || 8765);
            expect(result.enabledFeatures.admin).toBe(false);
            expect(consoleSpy.log).toHaveBeenCalledWith('⚠️ No webhook-config.json found, using defaults');
        });

        test('should handle invalid JSON gracefully', async () => {
            fs.readFile.mockResolvedValue('invalid json {');

            const result = await serverConfig.load();

            expect(result.port).toBe(process.env.WEBHOOK_PORT || 8765);
            expect(consoleSpy.log).toHaveBeenCalledWith('⚠️ No webhook-config.json found, using defaults');
        });
    });

    describe('Configuration getters and utilities', () => {
        beforeEach(() => {
            serverConfig = new ServerConfig();
            serverConfig.config = {
                adminToken: 'test-token',
                port: 9000,
                enabledFeatures: {
                    admin: true,
                    monitoring: false,
                    logging: true
                },
                cors: {
                    enabled: true,
                    origins: ['localhost']
                }
            };
        });

        test('get() should return copy of configuration', () => {
            const config = serverConfig.get();
            
            expect(config).toEqual(serverConfig.config);
            expect(config).not.toBe(serverConfig.config); // Should be a copy
        });

        test('getValue() should return correct values', () => {
            expect(serverConfig.getValue('port')).toBe(9000);
            expect(serverConfig.getValue('adminToken')).toBe('test-token');
            expect(serverConfig.getValue('cors.enabled')).toBe(true);
            expect(serverConfig.getValue('cors.origins')).toEqual(['localhost']);
            expect(serverConfig.getValue('nonexistent', 'default')).toBe('default');
            expect(serverConfig.getValue('nested.missing.key', 'fallback')).toBe('fallback');
        });

        test('isFeatureEnabled() should check feature flags correctly', () => {
            expect(serverConfig.isFeatureEnabled('admin')).toBe(true);
            expect(serverConfig.isFeatureEnabled('monitoring')).toBe(false);
            expect(serverConfig.isFeatureEnabled('logging')).toBe(true);
            expect(serverConfig.isFeatureEnabled('nonexistent')).toBe(false);
        });

        test('getPort() should return port as number', () => {
            expect(serverConfig.getPort()).toBe(9000);
        });

        test('getPort() should return default when port is invalid', () => {
            serverConfig.config.port = 'invalid';
            expect(serverConfig.getPort()).toBe(8765);
        });

        test('getAdminToken() should return admin token', () => {
            expect(serverConfig.getAdminToken()).toBe('test-token');
        });
    });

    describe('validate()', () => {
        beforeEach(() => {
            serverConfig = new ServerConfig();
        });

        test('should validate valid configuration', () => {
            serverConfig.config = {
                port: 8080,
                adminToken: null,
                enabledFeatures: { admin: false }
            };

            const result = serverConfig.validate();

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should detect invalid port', () => {
            serverConfig.config.port = 70000; // Invalid port

            const result = serverConfig.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid port number');
        });

        test('should detect missing admin token when admin is enabled', () => {
            serverConfig.config = {
                port: 8080,
                adminToken: null,
                enabledFeatures: { admin: true }
            };

            const result = serverConfig.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Admin feature enabled but no admin token provided');
        });

        test('should detect multiple validation errors', () => {
            serverConfig.config = {
                port: -1,
                adminToken: null,
                enabledFeatures: { admin: true }
            };

            const result = serverConfig.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors).toContain('Invalid port number');
            expect(result.errors).toContain('Admin feature enabled but no admin token provided');
        });
    });

    describe('createExample()', () => {
        test('should create example configuration file', async () => {
            const mockWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue();
            const filePath = '/test/example-config.json';

            const result = await ServerConfig.createExample(filePath);

            expect(mockWriteFile).toHaveBeenCalledWith(
                filePath,
                expect.stringContaining('"adminToken": "your-secure-admin-token-here"')
            );
            expect(result).toBe(filePath);

            mockWriteFile.mockRestore();
        });
    });
});