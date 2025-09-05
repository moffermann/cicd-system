// Mock HealthChecker
jest.mock('../../src/deployment/HealthChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkEndpoint: jest.fn()
    }));
});

const MonitoringPhase = require('../../src/deployment/MonitoringPhase.cjs');
const HealthChecker = require('../../src/deployment/HealthChecker.cjs');

describe('MonitoringPhase', () => {
    let monitoringPhase;
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
            PRODUCTION_URL: 'https://example.com',
            POST_DEPLOYMENT_MONITORING: 5000, // 5 seconds for testing
            ROLLBACK_THRESHOLD: 3,
            MAX_RESPONSE_TIME: 2000,
            MAX_ERROR_RATE: 0.05 // 5%
        };

        mockHealthChecker = {
            checkEndpoint: jest.fn()
        };
        HealthChecker.mockReturnValue(mockHealthChecker);

        monitoringPhase = new MonitoringPhase(mockLogger, mockConfig);

        // Clear mocks
        mockLogger.logPhase.mockClear();
        mockLogger.logProgress.mockClear();
        mockLogger.logSuccess.mockClear();
        mockLogger.logWarning.mockClear();
        mockLogger.logError.mockClear();
        mockLogger.logInfo.mockClear();
        mockHealthChecker.checkEndpoint.mockClear();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('Constructor', () => {
        test('should initialize with logger and config', () => {
            expect(monitoringPhase.logger).toBe(mockLogger);
            expect(monitoringPhase.config).toBe(mockConfig);
            expect(HealthChecker).toHaveBeenCalledWith(mockLogger, mockConfig);
            expect(monitoringPhase.errors).toEqual([]);
            expect(monitoringPhase.healthChecksPassed).toBe(0);
        });
    });

    describe('execute', () => {
        test('should complete monitoring successfully with healthy service', async () => {
            jest.useFakeTimers();
            
            mockHealthChecker.checkEndpoint.mockResolvedValue({
                healthy: true,
                status: 200,
                responseTime: 100
            });

            const executePromise = monitoringPhase.execute();

            // Advance time to trigger health checks and complete monitoring
            jest.advanceTimersByTime(6000); // More than monitoring duration

            const result = await executePromise;

            expect(mockLogger.logPhase).toHaveBeenCalledWith('PHASE 5', 'Iniciando monitoreo post-deployment...');
            expect(result.success).toBe(true);
            expect(result.healthChecksPassed).toBeGreaterThan(0);
            expect(result.errorsCount).toBe(0);
            expect(result.successRate).toBe(100);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith(expect.stringContaining('FASE 5 COMPLETADA'));
        });

        test('should handle monitoring with some errors but under threshold', async () => {
            jest.useFakeTimers();
            
            mockHealthChecker.checkEndpoint
                .mockResolvedValueOnce({ healthy: true, status: 200 })
                .mockResolvedValueOnce({ healthy: false, status: 500 })
                .mockResolvedValueOnce({ healthy: true, status: 200 });

            const executePromise = monitoringPhase.execute();

            // Advance time to complete monitoring
            jest.advanceTimersByTime(6000);

            const result = await executePromise;

            expect(result.success).toBe(true);
            expect(result.healthChecksPassed).toBe(2);
            expect(result.errorsCount).toBe(1);
            expect(result.successRate).toBe(200/3); // 2 passed out of 3 total
        });

        test('should fail when error threshold is exceeded', async () => {
            jest.useFakeTimers();
            
            mockHealthChecker.checkEndpoint.mockResolvedValue({
                healthy: false,
                status: 500
            });

            const executePromise = monitoringPhase.execute();

            // Advance time to trigger multiple failed health checks
            jest.advanceTimersByTime(120000); // 2 minutes to ensure multiple checks

            await expect(executePromise).rejects.toThrow('Too many errors detected');
            expect(mockLogger.logError).toHaveBeenCalledWith(expect.stringContaining('FASE 5 FALLIDA'));
        });

        test('should use default configuration values when not provided', () => {
            const configWithDefaults = {};
            const phaseWithDefaults = new MonitoringPhase(mockLogger, configWithDefaults);
            
            expect(phaseWithDefaults.config).toBe(configWithDefaults);
        });

        test('should log monitoring duration and interval info', async () => {
            jest.useFakeTimers();
            
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true, status: 200 });

            const executePromise = monitoringPhase.execute();
            jest.advanceTimersByTime(6000);
            
            await executePromise;

            expect(mockLogger.logInfo).toHaveBeenCalledWith(
                expect.stringContaining('Monitoreando por 5s con checks cada 30s')
            );
        });
    });

    describe('performHealthCheck', () => {
        test('should skip health check when PRODUCTION_URL is not configured', async () => {
            monitoringPhase.config.PRODUCTION_URL = null;

            await monitoringPhase.performHealthCheck();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('PRODUCTION_URL no configurada, saltando health check');
            expect(mockHealthChecker.checkEndpoint).not.toHaveBeenCalled();
        });

        test('should perform successful health check', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({
                healthy: true,
                status: 200,
                responseTime: 150
            });

            await monitoringPhase.performHealthCheck();

            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledWith(mockConfig.PRODUCTION_URL);
            expect(monitoringPhase.healthChecksPassed).toBe(1);
            expect(mockLogger.logProgress).toHaveBeenCalledWith('Health check OK (1 passed)');
            expect(monitoringPhase.errors).toHaveLength(0);
        });

        test('should handle failed health check', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({
                healthy: false,
                status: 500,
                responseTime: 300
            });

            await monitoringPhase.performHealthCheck();

            expect(monitoringPhase.healthChecksPassed).toBe(0);
            expect(monitoringPhase.errors).toHaveLength(1);
            expect(monitoringPhase.errors[0]).toMatchObject({
                error: 'Health check failed: 500',
                url: mockConfig.PRODUCTION_URL,
                timestamp: expect.any(Number)
            });
            expect(mockLogger.logWarning).toHaveBeenCalledWith('Health check failed (1 errors total)');
        });

        test('should warn about slow response times', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({
                healthy: true,
                status: 200,
                responseTime: 3000 // Exceeds MAX_RESPONSE_TIME of 2000ms
            });

            await monitoringPhase.performHealthCheck();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('Slow response time: 3000ms');
        });

        test('should handle health check exceptions', async () => {
            const error = new Error('Network timeout');
            mockHealthChecker.checkEndpoint.mockRejectedValue(error);

            await monitoringPhase.performHealthCheck();

            expect(monitoringPhase.errors).toHaveLength(1);
            expect(monitoringPhase.errors[0]).toMatchObject({
                error: 'Health check error: Network timeout',
                url: mockConfig.PRODUCTION_URL,
                timestamp: expect.any(Number)
            });
            expect(mockLogger.logError).toHaveBeenCalledWith('Health check error: Network timeout');
        });
    });

    describe('checkErrorRate', () => {
        test('should return true when error rate is within threshold', () => {
            monitoringPhase.healthChecksPassed = 95;
            monitoringPhase.errors = [{ error: 'test' }]; // 1 error out of 96 total = 1.04%

            const result = monitoringPhase.checkErrorRate();

            expect(result).toBe(true);
        });

        test('should return false when error rate exceeds threshold', () => {
            monitoringPhase.healthChecksPassed = 10;
            monitoringPhase.errors = [
                { error: 'test1' },
                { error: 'test2' },
                { error: 'test3' }
            ]; // 3 errors out of 13 total = 23%, exceeds 5% threshold

            const result = monitoringPhase.checkErrorRate();

            expect(result).toBe(false);
            expect(mockLogger.logError).toHaveBeenCalledWith(
                expect.stringContaining('Error rate too high: 23.08% (max: 5.00%)')
            );
        });

        test('should return 0 when no checks have been performed', () => {
            const result = monitoringPhase.checkErrorRate();

            expect(result).toBe(0);
        });

        test('should use default error rate when not configured', () => {
            monitoringPhase.config.MAX_ERROR_RATE = undefined;
            monitoringPhase.healthChecksPassed = 98;
            monitoringPhase.errors = [{ error: 'test' }, { error: 'test2' }]; // 2% error rate, exceeds default 1%

            const result = monitoringPhase.checkErrorRate();

            expect(result).toBe(false);
            expect(mockLogger.logError).toHaveBeenCalledWith(
                expect.stringContaining('Error rate too high: 2.00% (max: 1.00%)')
            );
        });
    });

    describe('getStats', () => {
        test('should return correct stats with mixed results', () => {
            monitoringPhase.healthChecksPassed = 8;
            monitoringPhase.errors = [
                { error: 'error1', timestamp: 123456 },
                { error: 'error2', timestamp: 123457 }
            ];

            const stats = monitoringPhase.getStats();

            expect(stats).toEqual({
                totalChecks: 10,
                healthChecksPassed: 8,
                errorsCount: 2,
                successRate: 80.00,
                errorRate: 20.00,
                errors: [
                    { error: 'error1', timestamp: 123456 },
                    { error: 'error2', timestamp: 123457 }
                ]
            });
        });

        test('should return zero stats when no checks performed', () => {
            const stats = monitoringPhase.getStats();

            expect(stats).toEqual({
                totalChecks: 0,
                healthChecksPassed: 0,
                errorsCount: 0,
                successRate: 0,
                errorRate: 0,
                errors: []
            });
        });

        test('should return 100% success rate when all checks pass', () => {
            monitoringPhase.healthChecksPassed = 5;

            const stats = monitoringPhase.getStats();

            expect(stats.successRate).toBe(100.00);
            expect(stats.errorRate).toBe(0);
        });

        test('should return copy of errors array', () => {
            const originalError = { error: 'test', timestamp: 123 };
            monitoringPhase.errors = [originalError];

            const stats = monitoringPhase.getStats();

            expect(stats.errors).not.toBe(monitoringPhase.errors);
            expect(stats.errors).toEqual([originalError]);
        });
    });

    describe('sleep', () => {
        test('should resolve after specified time', async () => {
            jest.useFakeTimers();
            
            const sleepPromise = monitoringPhase.sleep(1000);
            
            jest.advanceTimersByTime(999);
            // Promise should not resolve yet
            let resolved = false;
            sleepPromise.then(() => { resolved = true; });
            await Promise.resolve(); // Let microtask queue clear
            expect(resolved).toBe(false);
            
            jest.advanceTimersByTime(1);
            await sleepPromise;
            expect(resolved).toBe(true);
        });
    });
});