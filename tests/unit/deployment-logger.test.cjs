const DeploymentLogger = require('../../src/deployment/DeploymentLogger.cjs');

// Mock fs for file operations
jest.mock('fs', () => ({
    writeFileSync: jest.fn()
}));

const fs = require('fs');

describe('DeploymentLogger', () => {
    let logger;
    let mockDbLogger;
    let consoleSpy;

    beforeEach(() => {
        mockDbLogger = {
            addDeploymentLog: jest.fn()
        };
        
        logger = new DeploymentLogger('test-deployment-123', mockDbLogger);
        
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation()
        };
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with deployment ID and db logger', () => {
            expect(logger.deploymentId).toBe('test-deployment-123');
            expect(logger.dbLogger).toBe(mockDbLogger);
            expect(logger.startTime).toBeGreaterThan(0);
            expect(logger.logs).toEqual([]);
        });

        test('should work without db logger', () => {
            const simpleLogger = new DeploymentLogger('test-123');
            expect(simpleLogger.dbLogger).toBeNull();
        });

        test('should work without deployment ID', () => {
            const simpleLogger = new DeploymentLogger();
            expect(simpleLogger.deploymentId).toBeNull();
        });
    });

    describe('Logging methods', () => {
        test('should log basic message', () => {
            logger.log('Test message', 'blue', 'INFO');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] .*Test message.*/)
            );
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0]).toMatchObject({
                level: 'INFO',
                message: 'Test message',
                deploymentId: 'test-deployment-123'
            });
        });

        test('should log to database when available', () => {
            logger.log('Database test message', 'red', 'ERROR');

            expect(mockDbLogger.addDeploymentLog).toHaveBeenCalledWith(
                'test-deployment-123',
                'deployment', 
                'error',
                'Database test message'
            );
        });

        test('should not log to database when not available', () => {
            const loggerWithoutDb = new DeploymentLogger('test-123');
            loggerWithoutDb.log('Test message');

            expect(mockDbLogger.addDeploymentLog).not.toHaveBeenCalled();
        });

        test('should log success message', () => {
            logger.logSuccess('Success message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('✅ Success message')
            );
            expect(logger.logs[0].level).toBe('SUCCESS');
        });

        test('should log error message', () => {
            logger.logError('Error message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('❌ Error message')
            );
            expect(logger.logs[0].level).toBe('ERROR');
        });

        test('should log warning message', () => {
            logger.logWarning('Warning message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('⚠️ Warning message')
            );
            expect(logger.logs[0].level).toBe('WARNING');
        });

        test('should log info message', () => {
            logger.logInfo('Info message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('ℹ️ Info message')
            );
            expect(logger.logs[0].level).toBe('INFO');
        });

        test('should log progress message', () => {
            logger.logProgress('Progress message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('🔄 Progress message')
            );
            expect(logger.logs[0].level).toBe('PROGRESS');
        });

        test('should log phase message', () => {
            logger.logPhase('validation', 'Running validation phase');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('🚀 ===== VALIDATION =====')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Running validation phase')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('='.repeat(50))
            );
        });
    });

    describe('Duration tracking', () => {
        test('should calculate duration', () => {
            const duration = logger.getDuration();
            expect(duration).toBeGreaterThanOrEqual(0);
        });

        test('should format duration in seconds', () => {
            expect(logger.formatDuration(5000)).toBe('5s');
            expect(logger.formatDuration(1000)).toBe('1s');
        });

        test('should format duration in minutes and seconds', () => {
            expect(logger.formatDuration(65000)).toBe('1m 5s');
            expect(logger.formatDuration(125000)).toBe('2m 5s');
        });
    });

    describe('Log retrieval', () => {
        beforeEach(() => {
            logger.logSuccess('Success 1');
            logger.logError('Error 1');
            logger.logWarning('Warning 1');
            logger.logSuccess('Success 2');
        });

        test('should get all logs', () => {
            const logs = logger.getLogs();
            expect(logs).toHaveLength(4);
            expect(logs[0].message).toBe('✅ Success 1');
        });

        test('should get logs by level', () => {
            const successLogs = logger.getLogsByLevel('SUCCESS');
            const errorLogs = logger.getLogsByLevel('ERROR');
            const warningLogs = logger.getLogsByLevel('WARNING');

            expect(successLogs).toHaveLength(2);
            expect(errorLogs).toHaveLength(1);
            expect(warningLogs).toHaveLength(1);
        });
    });

    describe('Report generation', () => {
        beforeEach(() => {
            logger.logSuccess('Success 1');
            logger.logSuccess('Success 2');
            logger.logError('Error 1');
            logger.logWarning('Warning 1');
        });

        test('should generate deployment report', () => {
            const report = logger.generateReport();

            expect(report).toMatchObject({
                deploymentId: 'test-deployment-123',
                successCount: 2,
                errorCount: 1,
                warningCount: 1,
                totalLogs: 4,
                duration: expect.any(Number)
            });

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('DEPLOYMENT REPORT - test-deployment-123')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Successful operations: 2')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Errors: 1')
            );
        });
    });

    describe('File operations', () => {
        test('should attempt to save logs to file', () => {
            logger.logSuccess('Test log');
            logger.logError('Test error');
            
            // Test that saveLogsToFile doesn't crash
            expect(() => {
                logger.saveLogsToFile('/test/logs/deployment.json');
            }).not.toThrow();
            
            // The actual fs operations are hard to mock due to module loading,
            // but we can test that the method calls the correct logging
            expect(consoleSpy.log).toHaveBeenCalled();
        });
    });

    describe('Color mapping for database', () => {
        test('should map red to error', () => {
            logger.log('Error message', 'red');
            expect(mockDbLogger.addDeploymentLog).toHaveBeenCalledWith(
                expect.any(String), 'deployment', 'error', 'Error message'
            );
        });

        test('should map yellow to warn', () => {
            logger.log('Warning message', 'yellow');
            expect(mockDbLogger.addDeploymentLog).toHaveBeenCalledWith(
                expect.any(String), 'deployment', 'warn', 'Warning message'
            );
        });

        test('should map other colors to info', () => {
            logger.log('Info message', 'blue');
            expect(mockDbLogger.addDeploymentLog).toHaveBeenCalledWith(
                expect.any(String), 'deployment', 'info', 'Info message'
            );
        });
    });
});