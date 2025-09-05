// Mock dependencies
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

jest.mock('../../src/deployment/HealthChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkEndpoint: jest.fn()
    }));
});

const ProductionPhase = require('../../src/deployment/ProductionPhase.cjs');
const { execSync } = require('child_process');
const HealthChecker = require('../../src/deployment/HealthChecker.cjs');

describe('ProductionPhase', () => {
    let productionPhase;
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
            PROJECT_NAME: 'test-project',
            PRODUCTION_URL: 'https://example.com',
            DEPLOYMENT_TIMEOUT: 300000,
            HEALTH_ENDPOINTS: ['/health', '/api/status']
        };

        mockHealthChecker = {
            checkEndpoint: jest.fn()
        };
        HealthChecker.mockReturnValue(mockHealthChecker);

        productionPhase = new ProductionPhase(mockLogger, mockConfig);

        // Clear mocks
        mockLogger.logPhase.mockClear();
        mockLogger.logProgress.mockClear();
        mockLogger.logSuccess.mockClear();
        mockLogger.logWarning.mockClear();
        mockLogger.logError.mockClear();
        mockLogger.logInfo.mockClear();
        execSync.mockClear();
        mockHealthChecker.checkEndpoint.mockClear();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('Constructor', () => {
        test('should initialize with logger and config', () => {
            expect(productionPhase.logger).toBe(mockLogger);
            expect(productionPhase.config).toBe(mockConfig);
            expect(HealthChecker).toHaveBeenCalledWith(mockLogger, mockConfig);
            expect(productionPhase.rollbackData).toBeNull();
        });
    });

    describe('execute', () => {
        test('should complete production deployment successfully', async () => {
            execSync.mockReturnValueOnce('backup created'); // createProductionBackup
            execSync.mockReturnValueOnce('deployment success'); // deployToProduction
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true, status: 200 });

            const result = await productionPhase.execute();

            expect(mockLogger.logPhase).toHaveBeenCalledWith('PHASE 4', 'Ejecutando deployment a producción...');
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('FASE 4 COMPLETADA: Production deployment exitoso');
            expect(result.success).toBe(true);
            expect(result.rollbackData).toBeTruthy();
        });

        test('should handle deployment failure and attempt rollback', async () => {
            execSync
                .mockReturnValueOnce('backup created') // createProductionBackup
                .mockImplementationOnce(() => { throw new Error('Deploy failed'); }); // deployToProduction fails

            // Set rollback data to trigger rollback attempt
            productionPhase.rollbackData = { backupName: 'test-backup' };

            await expect(productionPhase.execute()).rejects.toThrow('Deploy failed');

            expect(mockLogger.logError).toHaveBeenCalledWith('FASE 4 FALLIDA: Deploy failed');
        });

        test('should skip rollback when no rollback data available', async () => {
            const error = new Error('Deploy failed');
            execSync.mockImplementation(() => { throw error; });

            await expect(productionPhase.execute()).rejects.toThrow('Deploy failed');

            expect(mockLogger.logError).toHaveBeenCalledWith('FASE 4 FALLIDA: Deploy failed');
            // Should not attempt rollback since rollbackData is null
        });
    });

    describe('createProductionBackup', () => {
        test('should create backup successfully', async () => {
            const mockDate = new Date('2023-01-01T10:30:45.123Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

            execSync.mockReturnValue('backup success');

            await productionPhase.createProductionBackup();

            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('npm run backup -- --name=backup-test-project-2023-01-01T10-30-45-123Z'),
                { stdio: 'pipe' }
            );
            expect(mockLogger.logSuccess).toHaveBeenCalledWith(
                expect.stringContaining('Backup creado: backup-test-project-')
            );
            expect(productionPhase.rollbackData).toMatchObject({
                projectName: 'test-project',
                productionUrl: 'https://example.com',
                backupName: expect.stringContaining('backup-test-project-')
            });

            global.Date.mockRestore();
        });

        test('should handle backup script not found', async () => {
            execSync.mockImplementation(() => {
                throw new Error('npm script not found');
            });

            await productionPhase.createProductionBackup();

            expect(mockLogger.logWarning).toHaveBeenCalledWith(
                'Script de backup no encontrado, continuando sin backup...'
            );
            expect(productionPhase.rollbackData.hasBackup).toBe(false);
        });

        test('should handle backup creation errors', async () => {
            const mockDate = new Date('2023-01-01T10:30:45.123Z');
            jest.spyOn(global, 'Date').mockImplementation(() => {
                throw new Error('Date error');
            });

            await expect(productionPhase.createProductionBackup()).rejects.toThrow('Date error');

            expect(mockLogger.logError).toHaveBeenCalledWith('Error creando backup: Date error');

            global.Date.mockRestore();
        });
    });

    describe('deployToProduction', () => {
        test('should deploy to production successfully', async () => {
            execSync.mockReturnValue('deployment success');

            await productionPhase.deployToProduction();

            expect(execSync).toHaveBeenCalledWith('npm run deploy:production', {
                stdio: 'inherit',
                timeout: 300000
            });
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Deployment a producción completado');
        });

        test('should use default timeout when not configured', async () => {
            productionPhase.config.DEPLOYMENT_TIMEOUT = undefined;
            execSync.mockReturnValue('deployment success');

            await productionPhase.deployToProduction();

            expect(execSync).toHaveBeenCalledWith('npm run deploy:production', {
                stdio: 'inherit',
                timeout: 300000 // default 5 minutes
            });
        });

        test('should handle deployment script errors', async () => {
            execSync.mockImplementation(() => {
                throw new Error('Deployment failed');
            });

            await expect(productionPhase.deployToProduction()).rejects.toThrow('Deployment failed');

            expect(mockLogger.logError).toHaveBeenCalledWith('Production deployment failed: Deployment failed');
        });
    });

    describe('verifyProductionDeployment', () => {
        test('should verify production deployment successfully', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true, status: 200 });

            await productionPhase.verifyProductionDeployment();

            expect(mockLogger.logProgress).toHaveBeenCalledWith('Verificando deployment de producción...');
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Verificación de producción completada');
        });

        test('should skip verification when PRODUCTION_URL is not configured', async () => {
            productionPhase.config.PRODUCTION_URL = null;

            await productionPhase.verifyProductionDeployment();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('PRODUCTION_URL no configurada, saltando verificación');
            expect(mockHealthChecker.checkEndpoint).not.toHaveBeenCalled();
        });

        test('should handle verification failures', async () => {
            mockHealthChecker.checkEndpoint.mockRejectedValue(new Error('Service unavailable'));

            await expect(productionPhase.verifyProductionDeployment()).rejects.toThrow();
        });
    });

    describe('waitForService', () => {
        test('should succeed when service is healthy on first attempt', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true, status: 200 });

            const result = await productionPhase.waitForService('https://example.com');

            expect(result).toBe(true);
            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledTimes(1);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Servicio disponible en https://example.com');
        });

        test('should retry and eventually succeed', async () => {
            jest.useFakeTimers();

            mockHealthChecker.checkEndpoint
                .mockResolvedValueOnce({ healthy: false, status: 503 })
                .mockResolvedValueOnce({ healthy: false, status: 503 })
                .mockResolvedValueOnce({ healthy: true, status: 200 });

            const waitPromise = productionPhase.waitForService('https://example.com', 5, 1000);

            // Advance through retries
            for (let i = 0; i < 2; i++) {
                await Promise.resolve();
                jest.advanceTimersByTime(1000);
            }

            const result = await waitPromise;

            expect(result).toBe(true);
            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledTimes(3);
            expect(mockLogger.logProgress).toHaveBeenCalledWith(
                expect.stringContaining('Intento 1/5 fallido, reintentando...')
            );
        });

        test('should throw error after max attempts', async () => {
            jest.useFakeTimers();

            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: false, status: 503 });

            const waitPromise = productionPhase.waitForService('https://example.com', 2, 1000);

            // Advance through all attempts
            await Promise.resolve();
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            await expect(waitPromise).rejects.toThrow(
                'Production service at https://example.com not available after 2 attempts'
            );
        });

        test('should handle health check exceptions', async () => {
            jest.useFakeTimers();

            mockHealthChecker.checkEndpoint
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({ healthy: true, status: 200 });

            const waitPromise = productionPhase.waitForService('https://example.com', 3, 500);

            await Promise.resolve();
            jest.advanceTimersByTime(500);

            const result = await waitPromise;

            expect(result).toBe(true);
            expect(mockLogger.logProgress).toHaveBeenCalledWith(
                expect.stringContaining('Intento 1/3 fallido, reintentando...')
            );
        });
    });

    describe('runProductionHealthChecks', () => {
        test('should run health checks on all endpoints successfully', async () => {
            mockHealthChecker.checkEndpoint
                .mockResolvedValueOnce({ healthy: true, status: 200, url: 'https://example.com/health' })
                .mockResolvedValueOnce({ healthy: true, status: 200, url: 'https://example.com/api/status' });

            const results = await productionPhase.runProductionHealthChecks();

            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledWith('https://example.com/health');
            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledWith('https://example.com/api/status');
            expect(results).toHaveLength(2);
            expect(mockLogger.logSuccess).toHaveBeenCalledWith(
                'Health checks completados: 2 endpoints verificados'
            );
        });

        test('should use default health endpoints when not configured', async () => {
            productionPhase.config.HEALTH_ENDPOINTS = undefined;
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: true, status: 200 });

            await productionPhase.runProductionHealthChecks();

            expect(mockHealthChecker.checkEndpoint).toHaveBeenCalledWith('https://example.com/health');
        });

        test('should throw error when health check fails', async () => {
            mockHealthChecker.checkEndpoint.mockResolvedValue({ healthy: false, status: 500 });

            await expect(productionPhase.runProductionHealthChecks()).rejects.toThrow(
                'Production health check failed for https://example.com/health'
            );
        });

        test('should throw error when health check throws exception', async () => {
            mockHealthChecker.checkEndpoint.mockRejectedValue(new Error('Connection timeout'));

            await expect(productionPhase.runProductionHealthChecks()).rejects.toThrow('Connection timeout');
        });
    });

    describe('attemptRollback', () => {
        test('should execute rollback successfully when backup data available', async () => {
            productionPhase.rollbackData = { backupName: 'test-backup-123' };
            execSync.mockReturnValue('rollback success');

            await productionPhase.attemptRollback();

            expect(execSync).toHaveBeenCalledWith('npm run rollback -- --backup=test-backup-123', {
                stdio: 'inherit',
                timeout: 180000
            });
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Rollback completado exitosamente');
        });

        test('should warn when no rollback data available', async () => {
            productionPhase.rollbackData = null;

            await productionPhase.attemptRollback();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('No hay datos de rollback disponibles');
            expect(execSync).not.toHaveBeenCalled();
        });

        test('should warn when backup is explicitly marked as unavailable', async () => {
            productionPhase.rollbackData = { backupName: 'test-backup', hasBackup: false };

            await productionPhase.attemptRollback();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('No hay datos de rollback disponibles');
            expect(execSync).not.toHaveBeenCalled();
        });

        test('should handle rollback script errors', async () => {
            productionPhase.rollbackData = { backupName: 'test-backup-123' };
            execSync.mockImplementation(() => {
                throw new Error('Rollback script failed');
            });

            await productionPhase.attemptRollback();

            expect(mockLogger.logError).toHaveBeenCalledWith('Rollback falló: Rollback script failed');
            expect(mockLogger.logError).toHaveBeenCalledWith('INTERVENCIÓN MANUAL REQUERIDA');
        });
    });

    describe('sleep', () => {
        test('should resolve after specified time', async () => {
            jest.useFakeTimers();

            const sleepPromise = productionPhase.sleep(2000);

            jest.advanceTimersByTime(1999);
            // Promise should not resolve yet
            let resolved = false;
            sleepPromise.then(() => { resolved = true; });
            await Promise.resolve();
            expect(resolved).toBe(false);

            jest.advanceTimersByTime(1);
            await sleepPromise;
            expect(resolved).toBe(true);
        });
    });
});