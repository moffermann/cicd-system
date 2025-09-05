const EnvironmentChecker = require('../../src/checklist/EnvironmentChecker.cjs');
const fs = require('fs/promises');

jest.mock('fs/promises', () => ({
    access: jest.fn()
}));

describe('EnvironmentChecker', () => {
    let environmentChecker;
    let mockLogger;
    let originalEnv;
    let originalVersion;

    beforeEach(() => {
        mockLogger = {
            addIssue: jest.fn()
        };
        
        environmentChecker = new EnvironmentChecker(mockLogger);
        
        // Backup original environment
        originalEnv = { ...process.env };
        originalVersion = process.version;
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
        Object.defineProperty(process, 'version', { value: originalVersion });
    });

    describe('checkEnvironment', () => {
        test('should return perfect score with all requirements met', async () => {
            // Set up good Node version
            Object.defineProperty(process, 'version', { value: 'v18.15.0' });
            
            // Set up environment variables
            process.env.PRODUCTION_URL = 'https://example.com';
            
            // Mock webhook config exists
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(3);
            expect(result.score.max).toBe(3);
            expect(result.details.nodeVersion).toBe('v18.15.0');
            expect(result.details.environmentVariables).toBe('1/1 configuradas');
            expect(result.details.webhookConfig).toBe('Configurado');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
        });

        test('should handle old Node.js version', async () => {
            Object.defineProperty(process, 'version', { value: 'v16.15.0' });
            process.env.PRODUCTION_URL = 'https://example.com';
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(2);
            expect(result.details.nodeVersion).toBe('v16.15.0');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Versión de Node.js muy antigua: v16.15.0');
        });

        test('should handle missing environment variables', async () => {
            Object.defineProperty(process, 'version', { value: 'v18.15.0' });
            delete process.env.PRODUCTION_URL;
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(2);
            expect(result.details.environmentVariables).toBe('0/1 configuradas');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Variable de entorno faltante: PRODUCTION_URL');
        });

        test('should handle missing webhook config', async () => {
            Object.defineProperty(process, 'version', { value: 'v18.15.0' });
            process.env.PRODUCTION_URL = 'https://example.com';
            fs.access.mockRejectedValue(new Error('File not found'));

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(2);
            expect(result.details.webhookConfig).toBe('Faltante');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Archivo webhook-config.json no encontrado');
        });

        test('should handle all failures', async () => {
            Object.defineProperty(process, 'version', { value: 'v14.15.0' });
            delete process.env.PRODUCTION_URL;
            fs.access.mockRejectedValue(new Error('File not found'));

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(0);
            expect(mockLogger.addIssue).toHaveBeenCalledTimes(3);
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Versión de Node.js muy antigua: v14.15.0');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Variable de entorno faltante: PRODUCTION_URL');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Archivo webhook-config.json no encontrado');
        });

        test('should handle partial successes', async () => {
            Object.defineProperty(process, 'version', { value: 'v20.0.0' });
            delete process.env.PRODUCTION_URL;
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(2); // Node version OK + Webhook config OK
            expect(result.details.nodeVersion).toBe('v20.0.0');
            expect(result.details.environmentVariables).toBe('0/1 configuradas');
            expect(result.details.webhookConfig).toBe('Configurado');
            expect(mockLogger.addIssue).toHaveBeenCalledTimes(1);
        });

        test('should handle edge case Node.js versions', async () => {
            Object.defineProperty(process, 'version', { value: 'v18.0.0' });
            process.env.PRODUCTION_URL = 'https://example.com';
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(3);
            expect(result.details.nodeVersion).toBe('v18.0.0');
        });

        test('should handle very old Node.js versions', async () => {
            Object.defineProperty(process, 'version', { value: 'v12.22.0' });
            process.env.PRODUCTION_URL = 'https://example.com';
            fs.access.mockResolvedValue();

            const result = await environmentChecker.checkEnvironment();

            expect(result.score.current).toBe(2);
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Versión de Node.js muy antigua: v12.22.0');
        });
    });
});