const CompleteStartupChecklist = require('../../src/claude-startup-checklist-complete.cjs');

// Mock all the checker modules
jest.mock('../../src/config/ProjectConfig.cjs', () => ({
    load: jest.fn()
}));

jest.mock('../../src/checklist/WebhookChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkRemoteWebhook: jest.fn(),
        checkLocalWebhook: jest.fn(),
        checkSSHTunnelService: jest.fn()
    }));
});

jest.mock('../../src/checklist/GitChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkRepository: jest.fn()
    }));
});

jest.mock('../../src/checklist/EnvironmentChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkEnvironment: jest.fn()
    }));
});

jest.mock('../../src/checklist/DependencyChecker.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        checkDependencies: jest.fn()
    }));
});

jest.mock('../../src/checklist/ChecklistLogger.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        addComponent: jest.fn(),
        calculateOverallStatus: jest.fn(),
        generateSummary: jest.fn(),
        saveResults: jest.fn(),
        displayResults: jest.fn(),
        getResults: jest.fn(),
        addIssue: jest.fn()
    }));
});

const ProjectConfig = require('../../src/config/ProjectConfig.cjs');
const WebhookChecker = require('../../src/checklist/WebhookChecker.cjs');
const GitChecker = require('../../src/checklist/GitChecker.cjs');
const EnvironmentChecker = require('../../src/checklist/EnvironmentChecker.cjs');
const DependencyChecker = require('../../src/checklist/DependencyChecker.cjs');
const ChecklistLogger = require('../../src/checklist/ChecklistLogger.cjs');

describe('CompleteStartupChecklist', () => {
    let checklist;
    let mockConfig;
    let mockLogger;
    let mockWebhookChecker;
    let mockGitChecker;
    let mockEnvironmentChecker;
    let mockDependencyChecker;
    let consoleSpy;

    beforeEach(() => {
        // Clear all previous mocks first
        jest.clearAllMocks();

        mockConfig = {
            projectName: 'test-project',
            productionUrl: 'https://example.com',
            port: 8765
        };

        mockLogger = {
            addComponent: jest.fn(),
            calculateOverallStatus: jest.fn(),
            generateSummary: jest.fn(),
            saveResults: jest.fn().mockResolvedValue(),
            displayResults: jest.fn(),
            getResults: jest.fn().mockReturnValue({ status: 'GOOD', score: 8, maxScore: 10 }),
            addIssue: jest.fn()
        };

        mockWebhookChecker = {
            checkRemoteWebhook: jest.fn(),
            checkLocalWebhook: jest.fn(),
            checkSSHTunnelService: jest.fn()
        };

        mockGitChecker = {
            checkRepository: jest.fn()
        };

        mockEnvironmentChecker = {
            checkEnvironment: jest.fn()
        };

        mockDependencyChecker = {
            checkDependencies: jest.fn()
        };

        // Set up mocks after clearing
        ProjectConfig.load.mockResolvedValue(mockConfig);
        ChecklistLogger.mockReturnValue(mockLogger);
        WebhookChecker.mockReturnValue(mockWebhookChecker);
        GitChecker.mockReturnValue(mockGitChecker);
        EnvironmentChecker.mockReturnValue(mockEnvironmentChecker);
        DependencyChecker.mockReturnValue(mockDependencyChecker);

        checklist = new CompleteStartupChecklist();
        
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(),
            error: jest.spyOn(console, 'error').mockImplementation()
        };
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with null checkers', () => {
            expect(checklist.config).toBeNull();
            expect(checklist.logger).toBeNull();
            expect(checklist.webhookChecker).toBeNull();
            expect(checklist.gitChecker).toBeNull();
            expect(checklist.environmentChecker).toBeNull();
            expect(checklist.dependencyChecker).toBeNull();
        });
    });

    describe('runChecklist', () => {
        beforeEach(() => {
            // Set up successful mock responses
            mockWebhookChecker.checkRemoteWebhook.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { endpoint: 'OK' }
            });

            mockWebhookChecker.checkLocalWebhook.mockResolvedValue({
                score: { current: 1, max: 2 },
                details: { localServer: 'OK' }
            });

            mockWebhookChecker.checkSSHTunnelService.mockResolvedValue({
                score: { current: 1, max: 1 },
                details: { sshTunnelService: 'Ejecutándose' }
            });

            mockGitChecker.checkRepository.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { repository: 'OK', uncommittedChanges: 'Ninguno', currentBranch: 'main' }
            });

            mockEnvironmentChecker.checkEnvironment.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { nodeVersion: 'v18.15.0', environmentVariables: '1/1 configuradas', webhookConfig: 'Configurado' }
            });

            mockDependencyChecker.checkDependencies.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { npmDependencies: 'OK', sshInstalled: 'OK' }
            });
        });

        test('should run complete checklist successfully', async () => {
            const result = await checklist.runChecklist();

            expect(ProjectConfig.load).toHaveBeenCalled();
            expect(consoleSpy.log).toHaveBeenCalledWith('🚀 CLAUDE STARTUP CHECKLIST COMPLETO - Verificando CI/CD...\n');
            expect(consoleSpy.log).toHaveBeenCalledWith('📁 Verificando proyecto: test-project\n');
            
            expect(ChecklistLogger).toHaveBeenCalled();
            expect(WebhookChecker).toHaveBeenCalledWith(mockConfig, mockLogger);
            expect(GitChecker).toHaveBeenCalledWith(mockLogger);
            expect(EnvironmentChecker).toHaveBeenCalledWith(mockLogger);
            expect(DependencyChecker).toHaveBeenCalledWith(mockLogger);

            expect(mockLogger.calculateOverallStatus).toHaveBeenCalled();
            expect(mockLogger.generateSummary).toHaveBeenCalled();
            expect(mockLogger.saveResults).toHaveBeenCalled();
            expect(mockLogger.displayResults).toHaveBeenCalled();

            expect(result).toEqual({ status: 'GOOD', score: 8, maxScore: 10 });
        });

        test('should handle configuration loading errors', async () => {
            const error = new Error('Config file not found');
            ProjectConfig.load.mockRejectedValue(error);

            const result = await checklist.runChecklist();

            expect(consoleSpy.error).toHaveBeenCalledWith('💥 Error fatal en checklist:', error);
            expect(result).toEqual({ status: 'ERROR', issues: ['Error fatal: Config file not found'] });
        });

        test('should handle errors during checks with logger available', async () => {
            const error = new Error('Check failed');
            // Setup the config loading to succeed first
            ProjectConfig.load.mockResolvedValue(mockConfig);
            
            // Create a real runAllChecks spy that will throw
            jest.spyOn(checklist, 'runAllChecks').mockRejectedValue(error);

            await checklist.runChecklist();

            expect(mockLogger.addIssue).toHaveBeenCalledWith('Error fatal: Check failed');
        });
    });

    describe('runAllChecks', () => {
        beforeEach(() => {
            // Initialize the checklist components manually for this test
            checklist.config = mockConfig;
            checklist.logger = mockLogger;
            checklist.webhookChecker = mockWebhookChecker;
            checklist.gitChecker = mockGitChecker;
            checklist.environmentChecker = mockEnvironmentChecker;
            checklist.dependencyChecker = mockDependencyChecker;

            // Set up mock responses
            mockWebhookChecker.checkRemoteWebhook.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { endpoint: 'OK' }
            });

            mockWebhookChecker.checkLocalWebhook.mockResolvedValue({
                score: { current: 1, max: 2 },
                details: { localServer: 'OK' }
            });

            mockWebhookChecker.checkSSHTunnelService.mockResolvedValue({
                score: { current: 1, max: 1 },
                details: { sshTunnelService: 'Ejecutándose' }
            });
        });

        test('should run all checks in sequence', async () => {
            mockGitChecker.checkRepository.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { repository: 'OK' }
            });

            mockEnvironmentChecker.checkEnvironment.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { nodeVersion: 'v18.15.0' }
            });

            mockDependencyChecker.checkDependencies.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { npmDependencies: 'OK' }
            });

            await checklist.runAllChecks();

            expect(mockWebhookChecker.checkRemoteWebhook).toHaveBeenCalled();
            expect(mockWebhookChecker.checkLocalWebhook).toHaveBeenCalled();
            expect(mockWebhookChecker.checkSSHTunnelService).toHaveBeenCalled();
            expect(mockGitChecker.checkRepository).toHaveBeenCalled();
            expect(mockEnvironmentChecker.checkEnvironment).toHaveBeenCalled();
            expect(mockDependencyChecker.checkDependencies).toHaveBeenCalled();

            expect(mockLogger.addComponent).toHaveBeenCalledTimes(5);
            expect(mockLogger.addComponent).toHaveBeenCalledWith('webhookRemote', expect.any(Object));
            expect(mockLogger.addComponent).toHaveBeenCalledWith('webhookLocal', expect.any(Object));
            expect(mockLogger.addComponent).toHaveBeenCalledWith('gitRepository', expect.any(Object));
            expect(mockLogger.addComponent).toHaveBeenCalledWith('environment', expect.any(Object));
            expect(mockLogger.addComponent).toHaveBeenCalledWith('dependencies', expect.any(Object));
        });

        test('should combine local webhook and SSH tunnel results', async () => {
            mockGitChecker.checkRepository.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { repository: 'OK' }
            });

            mockEnvironmentChecker.checkEnvironment.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { nodeVersion: 'v18.15.0' }
            });

            mockDependencyChecker.checkDependencies.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { npmDependencies: 'OK' }
            });

            await checklist.runAllChecks();

            const webhookLocalCall = mockLogger.addComponent.mock.calls.find(
                call => call[0] === 'webhookLocal'
            );

            expect(webhookLocalCall[1]).toEqual({
                score: { current: 2, max: 3 }, // 1 + 1 from local + ssh
                details: { 
                    localServer: 'OK',
                    sshTunnelService: 'Ejecutándose'
                }
            });
        });

        test('should display progress messages', async () => {
            mockGitChecker.checkRepository.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { repository: 'OK' }
            });

            mockEnvironmentChecker.checkEnvironment.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { nodeVersion: 'v18.15.0' }
            });

            mockDependencyChecker.checkDependencies.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { npmDependencies: 'OK' }
            });

            await checklist.runAllChecks();

            expect(consoleSpy.log).toHaveBeenCalledWith('🌐 Verificando webhook remoto...');
            expect(consoleSpy.log).toHaveBeenCalledWith('🏠 Verificando webhook local...');
            expect(consoleSpy.log).toHaveBeenCalledWith('📂 Verificando repositorio Git...');
            expect(consoleSpy.log).toHaveBeenCalledWith('🌍 Verificando entorno...');
            expect(consoleSpy.log).toHaveBeenCalledWith('📦 Verificando dependencias...');
        });

        test('should show score results', async () => {
            mockGitChecker.checkRepository.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { repository: 'OK' }
            });

            mockEnvironmentChecker.checkEnvironment.mockResolvedValue({
                score: { current: 3, max: 3 },
                details: { nodeVersion: 'v18.15.0' }
            });

            mockDependencyChecker.checkDependencies.mockResolvedValue({
                score: { current: 2, max: 2 },
                details: { npmDependencies: 'OK' }
            });

            await checklist.runAllChecks();

            expect(consoleSpy.log).toHaveBeenCalledWith('   2/2 ✅');
            expect(consoleSpy.log).toHaveBeenCalledWith('   2/3 ✅');
        });
    });
});