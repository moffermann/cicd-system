// Test for WebhookChecker
jest.mock('child_process');
jest.mock('util', () => ({
    promisify: jest.fn()
}));

const WebhookChecker = require('../../src/checklist/WebhookChecker.cjs');
const { exec } = require('child_process');
const util = require('util');

describe('WebhookChecker', () => {
    let webhookChecker;
    let mockConfig;
    let mockLogger;
    let mockExecAsync;

    beforeEach(() => {
        mockConfig = {
            productionUrl: 'https://example.com',
            port: 8765
        };
        
        mockLogger = {
            addIssue: jest.fn()
        };
        
        // Mock execAsync
        mockExecAsync = jest.fn();
        util.promisify.mockReturnValue(mockExecAsync);
        
        webhookChecker = new WebhookChecker(mockConfig, mockLogger);
        
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with config and logger', () => {
            expect(webhookChecker.config).toBe(mockConfig);
            expect(webhookChecker.logger).toBe(mockLogger);
        });
    });

    describe('checkSSHTunnelService', () => {
        test('should return success when SSH tunnel is running on Windows', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
            
            mockExecAsync.mockResolvedValue();

            const result = await webhookChecker.checkSSHTunnelService();

            expect(result.score.current).toBe(1);
            expect(result.score.max).toBe(1);
            expect(result.details.sshTunnelService).toBe('Ejecutándose');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle SSH tunnel service not found', async () => {
            const error = new Error('Service not found');
            mockExecAsync.mockRejectedValue(error);

            const result = await webhookChecker.checkSSHTunnelService();

            expect(result.score.current).toBe(0);
            expect(result.details.sshTunnelService).toBe('No encontrado');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Servicio SSH Tunnel no está ejecutándose');
        });

        test('should use correct command for different platforms', async () => {
            const originalPlatform = process.platform;
            
            // Test Linux
            Object.defineProperty(process, 'platform', { value: 'linux' });
            mockExecAsync.mockResolvedValue();
            
            await webhookChecker.checkSSHTunnelService();
            
            // Should use systemctl command for non-Windows
            expect(mockExecAsync).toHaveBeenCalled();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('fetchWithTimeout', () => {
        test('should have fetchWithTimeout method', () => {
            expect(typeof webhookChecker.fetchWithTimeout).toBe('function');
        });

        test('should handle fetch not available', async () => {
            await expect(
                webhookChecker.fetchWithTimeout('https://example.com')
            ).rejects.toThrow('Fetch not available - ES module compatibility issue');
        });
    });

    describe('checkRemoteWebhook - error handling', () => {
        test('should handle errors from fetchWithTimeout', async () => {
            // This tests the error handling path when fetch fails
            const result = await webhookChecker.checkRemoteWebhook();

            expect(result.score.current).toBe(0);
            expect(result.score.max).toBe(2);
            expect(result.details.endpoint).toContain('ERROR');
            expect(mockLogger.addIssue).toHaveBeenCalled();
        });
    });

    describe('checkLocalWebhook - error handling', () => {
        test('should handle errors from fetchWithTimeout', async () => {
            // This tests the error handling path when fetch fails
            const result = await webhookChecker.checkLocalWebhook();

            expect(result.score.current).toBe(0);
            expect(result.score.max).toBe(2);
            expect(result.details.localServer).toContain('ERROR');
            expect(mockLogger.addIssue).toHaveBeenCalled();
        });
    });
});