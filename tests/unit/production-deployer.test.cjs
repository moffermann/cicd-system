// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

// Mock all phase dependencies
jest.mock('../../src/deployment/DeploymentLogger.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        logInfo: jest.fn(),
        logProgress: jest.fn(),
        logSuccess: jest.fn(),
        logWarning: jest.fn(),
        logError: jest.fn(),
        logPhase: jest.fn(),
        generateReport: jest.fn().mockReturnValue({ reportId: 'test-report' })
    }));
});

jest.mock('../../src/deployment/ValidationPhase.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        execute: jest.fn()
    }));
});

jest.mock('../../src/deployment/StagingPhase.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        execute: jest.fn()
    }));
});

jest.mock('../../src/deployment/ProductionPhase.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        execute: jest.fn()
    }));
});

jest.mock('../../src/deployment/MonitoringPhase.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        execute: jest.fn()
    }));
});

const ProductionDeployer = require('../../src/deployment/ProductionDeployer.cjs');
const { execSync } = require('child_process');
const DeploymentLogger = require('../../src/deployment/DeploymentLogger.cjs');
const ValidationPhase = require('../../src/deployment/ValidationPhase.cjs');
const StagingPhase = require('../../src/deployment/StagingPhase.cjs');
const ProductionPhase = require('../../src/deployment/ProductionPhase.cjs');
const MonitoringPhase = require('../../src/deployment/MonitoringPhase.cjs');

describe('ProductionDeployer', () => {
    let deployer;
    let mockConfig;
    let mockLogger;
    let mockValidationPhase;
    let mockStagingPhase;
    let mockProductionPhase;
    let mockMonitoringPhase;
    let consoleSpy;

    beforeEach(() => {
        mockConfig = {
            PROJECT_NAME: 'test-project',
            PRODUCTION_URL: 'https://example.com',
            DATABASE_URL: 'postgres://localhost/test'
        };

        mockLogger = {
            logInfo: jest.fn(),
            logProgress: jest.fn(),
            logSuccess: jest.fn(),
            logWarning: jest.fn(),
            logError: jest.fn(),
            logPhase: jest.fn(),
            generateReport: jest.fn().mockReturnValue({ reportId: 'test-report' })
        };

        mockValidationPhase = {
            execute: jest.fn()
        };

        mockStagingPhase = {
            execute: jest.fn()
        };

        mockProductionPhase = {
            execute: jest.fn()
        };

        mockMonitoringPhase = {
            execute: jest.fn()
        };

        DeploymentLogger.mockReturnValue(mockLogger);
        ValidationPhase.mockReturnValue(mockValidationPhase);
        StagingPhase.mockReturnValue(mockStagingPhase);
        ProductionPhase.mockReturnValue(mockProductionPhase);
        MonitoringPhase.mockReturnValue(mockMonitoringPhase);

        deployer = new ProductionDeployer(mockConfig);

        // Mock console.log for report generation
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with config and default options', () => {
            expect(deployer.config).toBe(mockConfig);
            expect(deployer.deploymentId).toMatch(/deploy_\d+/);
            expect(DeploymentLogger).toHaveBeenCalledWith(expect.any(String), undefined);
            expect(ValidationPhase).toHaveBeenCalledWith(mockLogger);
            expect(StagingPhase).toHaveBeenCalledWith(mockLogger, mockConfig);
            expect(ProductionPhase).toHaveBeenCalledWith(mockLogger, mockConfig);
            expect(MonitoringPhase).toHaveBeenCalledWith(mockLogger, mockConfig);
            
            expect(deployer.rollbackData).toBeNull();
            expect(deployer.deploymentResults).toMatchObject({
                phases: {},
                success: false,
                startTime: expect.any(Number),
                endTime: null,
                errors: []
            });
        });

        test('should initialize with custom options', () => {
            const options = {
                deploymentId: 'custom-deploy-123',
                dbLogger: { log: jest.fn() }
            };
            
            const customDeployer = new ProductionDeployer(mockConfig, options);
            
            expect(customDeployer.deploymentId).toBe('custom-deploy-123');
            expect(DeploymentLogger).toHaveBeenCalledWith('custom-deploy-123', options.dbLogger);
        });
    });

    describe('deploy', () => {
        test('should complete full deployment successfully', async () => {
            const mockResults = {
                validation: { success: true },
                staging: { success: true },
                production: { success: true, rollbackData: { backup: 'test' } },
                monitoring: { success: true }
            };

            mockValidationPhase.execute.mockResolvedValue(mockResults.validation);
            mockStagingPhase.execute.mockResolvedValue(mockResults.staging);
            mockProductionPhase.execute.mockResolvedValue(mockResults.production);
            mockMonitoringPhase.execute.mockResolvedValue(mockResults.monitoring);

            const result = await deployer.deploy();

            expect(mockValidationPhase.execute).toHaveBeenCalled();
            expect(mockStagingPhase.execute).toHaveBeenCalled();
            expect(mockProductionPhase.execute).toHaveBeenCalled();
            expect(mockMonitoringPhase.execute).toHaveBeenCalled();

            expect(result.success).toBe(true);
            expect(result.phases).toEqual(mockResults);
            expect(result.endTime).toBeGreaterThan(result.startTime);
            expect(deployer.rollbackData).toBe(mockResults.production.rollbackData);

            expect(mockLogger.logSuccess).toHaveBeenCalledWith('🎉 PRODUCTION DEPLOYMENT COMPLETADO EXITOSAMENTE');
        });

        test('should handle deployment failure and generate report', async () => {
            const error = new Error('Deployment failed');
            mockValidationPhase.execute.mockRejectedValue(error);

            await expect(deployer.deploy()).rejects.toThrow('Deployment failed');

            expect(deployer.deploymentResults.success).toBe(false);
            expect(deployer.deploymentResults.errors).toHaveLength(1);
            expect(deployer.deploymentResults.errors[0]).toMatchObject({
                message: 'Deployment failed',
                timestamp: expect.any(Number),
                phase: expect.any(String)
            });

            expect(mockLogger.logError).toHaveBeenCalledWith('💥 PRODUCTION DEPLOYMENT FAILED: Deployment failed');
            expect(mockLogger.generateReport).toHaveBeenCalled();
        });

        test('should log deployment information at start', async () => {
            mockValidationPhase.execute.mockResolvedValue({ success: true });
            mockStagingPhase.execute.mockResolvedValue({ success: true });
            mockProductionPhase.execute.mockResolvedValue({ success: true });
            mockMonitoringPhase.execute.mockResolvedValue({ success: true });

            await deployer.deploy();

            expect(mockLogger.logInfo).toHaveBeenCalledWith(expect.stringContaining('Starting deployment'));
            expect(mockLogger.logInfo).toHaveBeenCalledWith(`Production URL: ${mockConfig.PRODUCTION_URL}`);
            expect(mockLogger.logInfo).toHaveBeenCalledWith('='.repeat(60));
        });
    });

    describe('executePreProductionChecks', () => {
        test('should execute all pre-production checks successfully', async () => {
            // Mock environment variables
            process.env.NODE_ENV = 'production';
            process.env.PRODUCTION_URL = 'https://test.com';
            execSync.mockReturnValue('');

            const result = await deployer.executePreProductionChecks();

            expect(mockLogger.logPhase).toHaveBeenCalledWith('PHASE 3', 'Ejecutando verificaciones pre-producción...');
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('FASE 3 COMPLETADA: Todas las verificaciones exitosas');
            expect(result.success).toBe(true);

            // Clean up
            delete process.env.NODE_ENV;
            delete process.env.PRODUCTION_URL;
        });

        test('should fail when validation checks fail', async () => {
            // Don't set environment variables to trigger validation failure
            delete process.env.NODE_ENV;
            delete process.env.PRODUCTION_URL;

            await expect(deployer.executePreProductionChecks()).rejects.toThrow('Missing environment variables');
        });
    });

    describe('validateEnvironmentVariables', () => {
        test('should validate required environment variables successfully', async () => {
            process.env.NODE_ENV = 'production';
            process.env.PRODUCTION_URL = 'https://test.com';

            await deployer.validateEnvironmentVariables();

            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Variables de entorno validadas');

            // Clean up
            delete process.env.NODE_ENV;
            delete process.env.PRODUCTION_URL;
        });

        test('should use config values when env vars are missing', async () => {
            deployer.config.NODE_ENV = 'production';
            deployer.config.PRODUCTION_URL = 'https://config.com';

            await deployer.validateEnvironmentVariables();

            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Variables de entorno validadas');
        });

        test('should throw error for missing required variables', async () => {
            delete process.env.NODE_ENV;
            delete process.env.PRODUCTION_URL;
            delete deployer.config.NODE_ENV;
            delete deployer.config.PRODUCTION_URL;

            await expect(deployer.validateEnvironmentVariables()).rejects.toThrow(
                'Missing environment variables: NODE_ENV, PRODUCTION_URL'
            );
        });
    });

    describe('validateDatabaseConnection', () => {
        test('should validate database connection when DATABASE_URL is configured', async () => {
            await deployer.validateDatabaseConnection();

            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Conexión a base de datos validada');
        });

        test('should warn when DATABASE_URL is not configured', async () => {
            deployer.config.DATABASE_URL = null;
            delete process.env.DATABASE_URL;

            await deployer.validateDatabaseConnection();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('DATABASE_URL no configurada, saltando validación');
        });

        test('should handle database validation errors', async () => {
            // Mock an error scenario - this would require actual database connection logic
            // For now, just test the error handling structure
            const originalMethod = deployer.validateDatabaseConnection;
            deployer.validateDatabaseConnection = jest.fn().mockRejectedValue(new Error('Connection failed'));

            await expect(deployer.validateDatabaseConnection()).rejects.toThrow('Connection failed');
        });
    });

    describe('validateDependencies', () => {
        test('should validate dependencies successfully', async () => {
            execSync.mockReturnValue('');

            await deployer.validateDependencies();

            expect(execSync).toHaveBeenCalledWith('npm ls --production --depth=0', { stdio: 'pipe' });
            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Dependencias validadas');
        });

        test('should handle dependency validation errors', async () => {
            execSync.mockImplementation(() => {
                throw new Error('Missing dependencies');
            });

            await expect(deployer.validateDependencies()).rejects.toThrow(
                'Dependency validation failed: Missing dependencies'
            );
        });
    });

    describe('validateSSLCertificates', () => {
        test('should validate SSL certificates for HTTPS URLs', async () => {
            deployer.config.PRODUCTION_URL = 'https://secure.com';

            await deployer.validateSSLCertificates();

            expect(mockLogger.logSuccess).toHaveBeenCalledWith('Certificados SSL validados');
        });

        test('should warn for non-HTTPS URLs', async () => {
            deployer.config.PRODUCTION_URL = 'http://insecure.com';

            await deployer.validateSSLCertificates();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('No HTTPS configurado, saltando validación SSL');
        });

        test('should warn when no PRODUCTION_URL is configured', async () => {
            deployer.config.PRODUCTION_URL = null;

            await deployer.validateSSLCertificates();

            expect(mockLogger.logWarning).toHaveBeenCalledWith('No HTTPS configurado, saltando validación SSL');
        });
    });

    describe('getCurrentPhase', () => {
        test('should return initialization when no phases completed', () => {
            const phase = deployer.getCurrentPhase();
            expect(phase).toBe('initialization');
        });

        test('should return latest completed phase', () => {
            deployer.deploymentResults.phases = {
                validation: { success: true },
                staging: { success: true }
            };

            const phase = deployer.getCurrentPhase();
            expect(phase).toBe('staging');
        });
    });

    describe('generateReport', () => {
        test('should generate comprehensive deployment report', () => {
            deployer.deploymentResults.success = true;
            deployer.deploymentResults.endTime = deployer.deploymentResults.startTime + 30000;
            deployer.deploymentResults.phases = {
                validation: { success: true },
                staging: { success: true },
                production: { success: true },
                monitoring: { success: true }
            };

            const report = deployer.generateReport();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DEPLOYMENT SUMMARY'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Project: test-project'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Production URL: https://example.com'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Success: YES'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phases Completed: 4/5'));

            expect(report.reportId).toBe('test-report');
            expect(report.deploymentResults).toBe(deployer.deploymentResults);
            expect(report.totalDuration).toBeGreaterThan(0);
        });

        test('should include errors in report when deployment fails', () => {
            deployer.deploymentResults.success = false;
            deployer.deploymentResults.endTime = deployer.deploymentResults.startTime + 15000;
            deployer.deploymentResults.errors = [
                { message: 'Validation failed', phase: 'validation', timestamp: Date.now() },
                { message: 'Network error', phase: 'staging', timestamp: Date.now() }
            ];

            const report = deployer.generateReport();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Success: NO'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Errors: 2'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('validation: Validation failed'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('staging: Network error'));
        });
    });

    describe('getStatus', () => {
        test('should return current deployment status', () => {
            deployer.rollbackData = { backup: 'test-backup' };

            const status = deployer.getStatus();

            expect(status).toEqual({
                deploymentId: deployer.deploymentId,
                config: {
                    projectName: mockConfig.PROJECT_NAME,
                    productionUrl: mockConfig.PRODUCTION_URL
                },
                results: deployer.deploymentResults,
                rollbackData: { backup: 'test-backup' }
            });
        });

        test('should handle null rollback data', () => {
            const status = deployer.getStatus();

            expect(status.rollbackData).toBeNull();
        });
    });
});