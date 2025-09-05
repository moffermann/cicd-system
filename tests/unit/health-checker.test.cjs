const HealthChecker = require('../../src/deployment/HealthChecker.cjs');

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

describe('HealthChecker', () => {
    let healthChecker;
    let mockLogger;
    let mockConfig;
    let fetch;

    beforeEach(() => {
        fetch = require('node-fetch');
        
        mockLogger = {
            logProgress: jest.fn(),
            logSuccess: jest.fn(),
            logError: jest.fn(),
            logInfo: jest.fn(),
            logWarning: jest.fn()
        };

        mockConfig = {
            HEALTH_CHECK_TIMEOUT: 10000
        };

        healthChecker = new HealthChecker(mockLogger, mockConfig);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('Constructor', () => {
        test('should initialize with logger and config', () => {
            expect(healthChecker.logger).toBe(mockLogger);
            expect(healthChecker.config).toBe(mockConfig);
        });
    });

    describe('checkEndpoint', () => {
        test('should return healthy status for successful response', async () => {
            const mockResponse = {
                ok: true,
                status: 200
            };
            fetch.mockResolvedValue(mockResponse);

            const result = await healthChecker.checkEndpoint('http://example.com');

            expect(fetch).toHaveBeenCalledWith('http://example.com', {
                method: 'GET',
                signal: expect.any(AbortSignal),
                headers: {
                    'User-Agent': 'CICD-Health-Check/1.0'
                }
            });
            expect(result).toEqual({
                url: 'http://example.com',
                status: 200,
                healthy: true,
                responseTime: expect.any(Number)
            });
            expect(mockLogger.logProgress).toHaveBeenCalledWith('Verificando endpoint: http://example.com');
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('✅ http://example.com respondió correctamente (200)');
        });

        test('should return unhealthy status for error response', async () => {
            const mockResponse = {
                ok: false,
                status: 500
            };
            fetch.mockResolvedValue(mockResponse);

            const result = await healthChecker.checkEndpoint('http://example.com');

            expect(result).toEqual({
                url: 'http://example.com',
                status: 500,
                healthy: false,
                responseTime: expect.any(Number)
            });
            expect(mockLogger.logError).toHaveBeenCalledWith('❌ http://example.com respondió con error (500)');
        });

        test('should handle network errors', async () => {
            const error = new Error('Network error');
            fetch.mockRejectedValue(error);

            const result = await healthChecker.checkEndpoint('http://example.com');

            expect(result).toEqual({
                url: 'http://example.com',
                status: 0,
                healthy: false,
                error: 'Network error'
            });
            expect(mockLogger.logError).toHaveBeenCalledWith('❌ http://example.com no accesible: Network error');
        });

        test('should handle timeout', async () => {
            jest.useFakeTimers();
            
            fetch.mockImplementation(() => 
                new Promise((resolve) => {
                    setTimeout(() => resolve({ ok: true, status: 200 }), 15000);
                })
            );

            const resultPromise = healthChecker.checkEndpoint('http://example.com', 5000);
            
            jest.advanceTimersByTime(5000);
            
            const result = await resultPromise;

            expect(result.healthy).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should use custom timeout', async () => {
            const mockResponse = { ok: true, status: 200 };
            fetch.mockResolvedValue(mockResponse);

            await healthChecker.checkEndpoint('http://example.com', 5000);

            // Verify the AbortController timeout was set correctly
            expect(fetch).toHaveBeenCalledWith('http://example.com', {
                method: 'GET',
                signal: expect.any(AbortSignal),
                headers: {
                    'User-Agent': 'CICD-Health-Check/1.0'
                }
            });
        });
    });

    describe('performHealthChecks', () => {
        test('should check multiple endpoints successfully', async () => {
            jest.spyOn(healthChecker, 'checkEndpoint')
                .mockResolvedValueOnce({ url: 'http://example.com/health', healthy: true })
                .mockResolvedValueOnce({ url: 'http://example.com/api/health', healthy: true });

            const result = await healthChecker.performHealthChecks('http://example.com');

            expect(healthChecker.checkEndpoint).toHaveBeenCalledTimes(2);
            expect(healthChecker.checkEndpoint).toHaveBeenCalledWith('http://example.com/health', mockConfig.HEALTH_CHECK_TIMEOUT);
            expect(healthChecker.checkEndpoint).toHaveBeenCalledWith('http://example.com/api/health', mockConfig.HEALTH_CHECK_TIMEOUT);

            expect(result).toEqual({
                healthy: true,
                healthyCount: 2,
                totalCount: 2,
                healthPercentage: 100,
                results: [
                    { url: 'http://example.com/health', healthy: true },
                    { url: 'http://example.com/api/health', healthy: true }
                ]
            });

            expect(mockLogger.logInfo).toHaveBeenCalledWith('Health checks: 2/2 (100%) pasaron');
        });

        test('should handle partial failures', async () => {
            jest.spyOn(healthChecker, 'checkEndpoint')
                .mockResolvedValueOnce({ url: 'http://example.com/health', healthy: true })
                .mockResolvedValueOnce({ url: 'http://example.com/api/health', healthy: false });

            const result = await healthChecker.performHealthChecks('http://example.com');

            expect(result).toEqual({
                healthy: false,
                healthyCount: 1,
                totalCount: 2,
                healthPercentage: 50,
                results: [
                    { url: 'http://example.com/health', healthy: true },
                    { url: 'http://example.com/api/health', healthy: false }
                ]
            });

            expect(mockLogger.logInfo).toHaveBeenCalledWith('Health checks: 1/2 (50%) pasaron');
            expect(mockLogger.logWarning).toHaveBeenCalledWith('Algunos endpoints de salud fallaron');
        });

        test('should use custom endpoints', async () => {
            jest.spyOn(healthChecker, 'checkEndpoint')
                .mockResolvedValue({ url: 'http://example.com/status', healthy: true });

            await healthChecker.performHealthChecks('http://example.com', ['/status']);

            expect(healthChecker.checkEndpoint).toHaveBeenCalledWith('http://example.com/status', mockConfig.HEALTH_CHECK_TIMEOUT);
        });
    });

    describe('waitForHealthy', () => {
        test('should return true when service becomes healthy on first attempt', async () => {
            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValue({ healthy: true });

            const result = await healthChecker.waitForHealthy('http://example.com');

            expect(result).toBe(true);
            expect(healthChecker.performHealthChecks).toHaveBeenCalledTimes(1);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('http://example.com está saludable después de 1 intentos');
        });

        test('should retry and eventually succeed', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValueOnce({ healthy: false })
                .mockResolvedValueOnce({ healthy: false })
                .mockResolvedValueOnce({ healthy: true });

            const resultPromise = healthChecker.waitForHealthy('http://example.com', 5, 1000);

            // Advance through the retries
            for (let i = 0; i < 2; i++) {
                await Promise.resolve(); // Let the first call complete
                jest.advanceTimersByTime(1000);
            }

            const result = await resultPromise;

            expect(result).toBe(true);
            expect(healthChecker.performHealthChecks).toHaveBeenCalledTimes(3);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('http://example.com está saludable después de 3 intentos');
        });

        test('should return false after max attempts', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValue({ healthy: false });

            const resultPromise = healthChecker.waitForHealthy('http://example.com', 2, 1000);

            // Advance through all retries
            await Promise.resolve(); // First attempt
            jest.advanceTimersByTime(1000);
            await Promise.resolve(); // Second attempt

            const result = await resultPromise;

            expect(result).toBe(false);
            expect(healthChecker.performHealthChecks).toHaveBeenCalledTimes(2);
            expect(mockLogger.logError).toHaveBeenCalledWith('http://example.com no pudo ser alcanzado después de 2 intentos');
        });

        test('should log progress during retries', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValueOnce({ healthy: false })
                .mockResolvedValueOnce({ healthy: true });

            const resultPromise = healthChecker.waitForHealthy('http://example.com', 3, 2000);

            await Promise.resolve(); // First attempt
            jest.advanceTimersByTime(2000);

            await resultPromise;

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Esperando que http://example.com esté saludable...');
            expect(mockLogger.logProgress).toHaveBeenCalledWith('Intento 1/3...');
            expect(mockLogger.logProgress).toHaveBeenCalledWith('Intento 2/3...');
            expect(mockLogger.logInfo).toHaveBeenCalledWith('Esperando 2s antes del próximo intento...');
        });
    });

    describe('continuousMonitoring', () => {
        test('should complete monitoring successfully with high success rate', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValue({ healthy: true });

            const monitoringPromise = healthChecker.continuousMonitoring('http://example.com', 10000, 2000);

            // Advance through monitoring period
            for (let i = 0; i < 5; i++) {
                await Promise.resolve();
                jest.advanceTimersByTime(2000);
            }

            const result = await monitoringPromise;

            expect(result.success).toBe(true);
            expect(result.successRate).toBe(100);
            expect(result.totalChecks).toBeGreaterThan(0);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith(expect.stringContaining('Monitoreo completado'));
        });

        test('should detect consecutive failures and stop monitoring', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValue({ healthy: false });

            const monitoringPromise = healthChecker.continuousMonitoring('http://example.com', 20000, 1000);

            // Advance through 3 consecutive failures
            for (let i = 0; i < 3; i++) {
                await Promise.resolve();
                jest.advanceTimersByTime(1000);
            }

            const result = await monitoringPromise;

            expect(result.success).toBe(false);
            expect(result.reason).toBe('3 fallos consecutivos');
            expect(mockLogger.logError).toHaveBeenCalledWith('¡ALERTA! 3 fallos consecutivos detectados');
        });

        test('should reset consecutive failures counter on successful check', async () => {
            jest.useFakeTimers();

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValueOnce({ healthy: false }) // Failure 1
                .mockResolvedValueOnce({ healthy: false }) // Failure 2
                .mockResolvedValueOnce({ healthy: true })  // Success (resets counter)
                .mockResolvedValueOnce({ healthy: false }) // Failure 1 again
                .mockResolvedValueOnce({ healthy: true });  // Success

            const monitoringPromise = healthChecker.continuousMonitoring('http://example.com', 10000, 1000);

            // Advance through the checks
            for (let i = 0; i < 5; i++) {
                await Promise.resolve();
                jest.advanceTimersByTime(1000);
            }

            const result = await monitoringPromise;

            // Should complete successfully since consecutive failures were reset
            expect(result.success).toBeDefined();
            expect(mockLogger.logWarning).toHaveBeenCalledWith('Fallo de salud consecutivo #1');
            expect(mockLogger.logWarning).toHaveBeenCalledWith('Fallo de salud consecutivo #2');
        });

        test('should track timestamps and results correctly', async () => {
            jest.useFakeTimers();
            const mockDate = new Date('2023-01-01T00:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

            jest.spyOn(healthChecker, 'performHealthChecks')
                .mockResolvedValue({ healthy: true, healthyCount: 1 });

            const monitoringPromise = healthChecker.continuousMonitoring('http://example.com', 3000, 1000);

            // Advance through monitoring
            for (let i = 0; i < 3; i++) {
                await Promise.resolve();
                jest.advanceTimersByTime(1000);
            }

            const result = await monitoringPromise;

            expect(result.checks).toBeDefined();
            expect(result.checks.length).toBeGreaterThan(0);
            expect(result.checks[0]).toMatchObject({
                timestamp: expect.any(String),
                healthy: true,
                healthyCount: 1
            });

            global.Date.mockRestore();
        });
    });
});