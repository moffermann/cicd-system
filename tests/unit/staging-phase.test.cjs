// Mock dependencies
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

jest.mock('../../src/deployment/HealthChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkEndpoint: jest.fn(),
        runSmokeTests: jest.fn(),
        checkDatabaseConnection: jest.fn()
    }));
});

const StagingPhase = require('../../src/deployment/StagingPhase.cjs');
const { execSync } = require('child_process');
const HealthChecker = require('../../src/deployment/HealthChecker.cjs');

describe('StagingPhase', () => {
    let stagingPhase;
    let mockLogger;
    let mockConfig;
    let mockHealthChecker;

    beforeEach(() => {
        mockLogger = {
            logPhase: jest.fn(),
            logProgress: jest.fn(),
            logSuccess: jest.fn(),
            logWarning: jest.fn(),
            logError: jest.fn(),
            logInfo: jest.fn()
        };

        mockConfig = {
            STAGING_URL: 'https://staging.example.com',
            PROJECT_NAME: 'test-project',
            STAGING_DEPLOY_PATH: '/var/www/staging'
        };

        mockHealthChecker = {
            checkEndpoint: jest.fn(),
            runSmokeTests: jest.fn(),
            checkDatabaseConnection: jest.fn()
        };
        HealthChecker.mockReturnValue(mockHealthChecker);

        stagingPhase = new StagingPhase(mockLogger, mockConfig);

        // Clear mocks
        mockLogger.logPhase.mockClear();
        mockLogger.logProgress.mockClear();
        mockLogger.logSuccess.mockClear();
        mockLogger.logWarning.mockClear();
        mockLogger.logError.mockClear();
        mockLogger.logInfo.mockClear();
        execSync.mockClear();
        mockHealthChecker.checkEndpoint.mockClear();
        mockHealthChecker.runSmokeTests.mockClear();
        mockHealthChecker.checkDatabaseConnection.mockClear();
    });

    describe('Constructor', () => {
        test('should initialize with logger and config', () => {
            expect(stagingPhase.logger).toBe(mockLogger);
            expect(stagingPhase.config).toBe(mockConfig);
            expect(HealthChecker).toHaveBeenCalledWith(mockLogger, mockConfig);
        });
    });

    describe('execute', () => {
        test('should complete staging deployment successfully', async () => {
            execSync.mockReturnValue('staging deploy success');
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true });
            mockHealthChecker.runSmokeTests.mockResolvedValue({ success: true });

            const result = await stagingPhase.execute();

            expect(mockLogger.logPhase).toHaveBeenCalledWith('PHASE 2', 'Desplegando a staging...');
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('FASE 2 COMPLETADA: Staging deployment exitoso');
            expect(result.success).toBe(true);
        });

        test('should handle staging deployment failure gracefully', async () => {
            const error = new Error('Deploy failed');
            execSync.mockImplementation(() => {
                throw error;
            });

            const result = await stagingPhase.execute();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('FASE 2 SALTADA: Staging no disponible, continuando con producción...');
            expect(result.success).toBe(false);
            expect(result.skipped).toBe(true);
            expect(result.error).toBe('Deploy failed');
        });

        test('should skip staging checks when STAGING_URL is not provided', async () => {
            stagingPhase.config.STAGING_URL = null;
            execSync.mockReturnValue('deploy success');

            const result = await stagingPhase.execute();

            expect(mockHealthChecker.checkEndpoint).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('deployToStaging', () => {
        test('should execute staging deployment commands', async () => {
            execSync.mockReturnValue('staging deploy output');

            await stagingPhase.deployToStaging();

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Desplegando aplicación a staging...');
            expect(execSync).toHaveBeenCalled();
        });

        test('should handle deployment script errors', async () => {
            const error = new Error('Script failed');
            execSync.mockImplementation(() => {
                throw error;
            });

            await expect(stagingPhase.deployToStaging()).rejects.toThrow('Script failed');
        });
    });

    describe('waitForService', () => {
        test('should wait for service to be ready', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true });

            await stagingPhase.waitForService('https://staging.example.com');

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Esperando a que staging esté listo...');
            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledWith('https://staging.example.com/health');
        });

        test('should retry on service not ready', async () => {
            mockHealthChecker.checkEndpoint
                .mockResolvedValueOnce({ healthy: false })
                .mockResolvedValueOnce({ healthy: true });

            await stagingPhase.waitForService('https://staging.example.com');

            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledTimes(2);
        });

        test('should timeout after max retries', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: false });

            await expect(
                stagingPhase.waitForService('https://staging.example.com')
            ).rejects.toThrow('Staging service no respondió después de');
        });
    });

    describe('runSmokeTests', () => {
        test('should run smoke tests successfully', async () => {
            mockHealthChecker.runSmokeTests.mockResolvedValue({ success: true, tests: 5 });

            await stagingPhase.runSmokeTests('https://staging.example.com');

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Ejecutando smoke tests en staging...');
            expect(mockHealthChecker.runSmokeTests).toHaveBeenCalledWith('https://staging.example.com');
        });

        test('should handle smoke test failures', async () => {
            mockHealthChecker.runSmokeTests.mockRejectedValue(new Error('Tests failed'));

            await expect(
                stagingPhase.runSmokeTests('https://staging.example.com')
            ).rejects.toThrow('Tests failed');
        });
    });

    describe('runPerformanceTests', () => {
        test('should execute performance tests', async () => {
            execSync.mockReturnValue('performance test results');

            await stagingPhase.runPerformanceTests('https://staging.example.com');

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Ejecutando pruebas de rendimiento...');
            expect(execSync).toHaveBeenCalled();
        });

        test('should handle performance test failures gracefully', async () => {
            execSync.mockImplementation(() => {
                throw new Error('Performance tests failed');
            });

            // Should not throw, just log warning
            await expect(stagingPhase.runPerformanceTests('https://staging.example.com')).resolves.not.toThrow();
            expect(mockLogger.logWarning).toHaveBeenCalled();
        });
    });
});