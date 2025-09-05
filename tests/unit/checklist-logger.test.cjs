const ChecklistLogger = require('../../src/checklist/ChecklistLogger.cjs');
const fs = require('fs/promises');

jest.mock('fs/promises', () => ({
    writeFile: jest.fn()
}));

describe('ChecklistLogger', () => {
    let checklistLogger;
    let consoleSpy;

    beforeEach(() => {
        checklistLogger = new ChecklistLogger('test-session-123');
        
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(),
            error: jest.spyOn(console, 'error').mockImplementation()
        };
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with custom session', () => {
            expect(checklistLogger.results.session).toBe('test-session-123');
            expect(checklistLogger.results.status).toBe('UNKNOWN');
            expect(checklistLogger.results.score).toBe(0);
            expect(checklistLogger.results.maxScore).toBe(0);
            expect(checklistLogger.results.issues).toEqual([]);
            expect(checklistLogger.results.components).toEqual({});
        });

        test('should initialize with default session when none provided', () => {
            const defaultLogger = new ChecklistLogger();
            expect(defaultLogger.results.session).toMatch(/^claude-\d+$/);
        });

        test('should have valid timestamp', () => {
            const timestamp = new Date(checklistLogger.results.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 1000);
        });
    });

    describe('addIssue', () => {
        test('should add issues to the results', () => {
            checklistLogger.addIssue('Test issue 1');
            checklistLogger.addIssue('Test issue 2');

            expect(checklistLogger.results.issues).toEqual([
                'Test issue 1',
                'Test issue 2'
            ]);
        });
    });

    describe('addComponent', () => {
        test('should add component results and update scores', () => {
            const componentResult = {
                score: { current: 2, max: 3 },
                details: { test: 'OK', another: 'Failed' }
            };

            checklistLogger.addComponent('testComponent', componentResult);

            expect(checklistLogger.results.components.testComponent).toBe(componentResult);
            expect(checklistLogger.results.score).toBe(2);
            expect(checklistLogger.results.maxScore).toBe(3);
        });

        test('should accumulate scores from multiple components', () => {
            checklistLogger.addComponent('component1', {
                score: { current: 2, max: 3 },
                details: {}
            });

            checklistLogger.addComponent('component2', {
                score: { current: 1, max: 2 },
                details: {}
            });

            expect(checklistLogger.results.score).toBe(3);
            expect(checklistLogger.results.maxScore).toBe(5);
        });
    });

    describe('calculateOverallStatus', () => {
        test('should calculate EXCELLENT status (90%+)', () => {
            checklistLogger.results.score = 9;
            checklistLogger.results.maxScore = 10;

            checklistLogger.calculateOverallStatus();

            expect(checklistLogger.results.status).toBe('EXCELLENT');
        });

        test('should calculate GOOD status (75-89%)', () => {
            checklistLogger.results.score = 8;
            checklistLogger.results.maxScore = 10;

            checklistLogger.calculateOverallStatus();

            expect(checklistLogger.results.status).toBe('GOOD');
        });

        test('should calculate FAIR status (60-74%)', () => {
            checklistLogger.results.score = 7;
            checklistLogger.results.maxScore = 10;

            checklistLogger.calculateOverallStatus();

            expect(checklistLogger.results.status).toBe('FAIR');
        });

        test('should calculate POOR status (<60%)', () => {
            checklistLogger.results.score = 5;
            checklistLogger.results.maxScore = 10;

            checklistLogger.calculateOverallStatus();

            expect(checklistLogger.results.status).toBe('POOR');
        });

        test('should handle edge cases', () => {
            checklistLogger.results.score = 0;
            checklistLogger.results.maxScore = 0;

            checklistLogger.calculateOverallStatus();

            expect(checklistLogger.results.status).toBe('POOR'); // 0/0 = NaN which is < 60
        });
    });

    describe('generateSummary', () => {
        test('should generate summary with no issues', () => {
            checklistLogger.results.score = 8;
            checklistLogger.results.maxScore = 10;
            checklistLogger.results.issues = [];

            checklistLogger.generateSummary();

            expect(checklistLogger.results.summary).toBe(
                'CI/CD Health Check: 80% (8/10) - ✅ Todo funcionando correctamente'
            );
        });

        test('should generate summary with issues', () => {
            checklistLogger.results.score = 6;
            checklistLogger.results.maxScore = 10;
            checklistLogger.results.issues = ['Issue 1', 'Issue 2', 'Issue 3'];

            checklistLogger.generateSummary();

            expect(checklistLogger.results.summary).toBe(
                'CI/CD Health Check: 60% (6/10) - ⚠️ 3 problema(s) encontrado(s)'
            );
        });
    });

    describe('saveResults', () => {
        test('should save results to file successfully', async () => {
            fs.writeFile.mockResolvedValue();

            await checklistLogger.saveResults();

            expect(fs.writeFile).toHaveBeenCalledWith(
                'checklist-test-session-123.json',
                expect.stringContaining('"session": "test-session-123"'),
                
            );
            expect(consoleSpy.log).toHaveBeenCalledWith('💾 Resultados guardados en checklist-test-session-123.json');
        });

        test('should handle file save errors', async () => {
            const error = new Error('Permission denied');
            fs.writeFile.mockRejectedValue(error);

            await checklistLogger.saveResults();

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Error guardando resultados:', 'Permission denied');
        });
    });

    describe('displayResults', () => {
        beforeEach(() => {
            checklistLogger.results.score = 7;
            checklistLogger.results.maxScore = 10;
            checklistLogger.results.status = 'FAIR';
        });

        test('should display results with no issues', () => {
            checklistLogger.results.issues = [];
            checklistLogger.results.components = {
                test1: {
                    score: { current: 2, max: 3 },
                    details: { check1: 'OK', check2: 'Failed' }
                }
            };

            checklistLogger.displayResults();

            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('RESUMEN DEL HEALTH CHECK'));
            expect(consoleSpy.log).toHaveBeenCalledWith('🎯 Score: 7/10 (70%)');
            expect(consoleSpy.log).toHaveBeenCalledWith('🏆 Status: FAIR');
            expect(consoleSpy.log).toHaveBeenCalledWith('✅ No se encontraron problemas');
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('TEST1'));
        });

        test('should display results with issues', () => {
            checklistLogger.results.issues = ['Issue 1', 'Issue 2'];
            checklistLogger.results.components = {};

            checklistLogger.displayResults();

            expect(consoleSpy.log).toHaveBeenCalledWith('🚨 PROBLEMAS ENCONTRADOS:');
            expect(consoleSpy.log).toHaveBeenCalledWith('   1. Issue 1');
            expect(consoleSpy.log).toHaveBeenCalledWith('   2. Issue 2');
        });

        test('should display component details', () => {
            checklistLogger.results.issues = [];
            checklistLogger.results.components = {
                webhook: {
                    score: { current: 1, max: 2 },
                    details: { 
                        endpoint: 'OK',
                        tunnel: 'Failed' 
                    }
                }
            };

            checklistLogger.displayResults();

            expect(consoleSpy.log).toHaveBeenCalledWith('🔧 WEBHOOK:');
            expect(consoleSpy.log).toHaveBeenCalledWith('   Score: 1/2');
            expect(consoleSpy.log).toHaveBeenCalledWith('   endpoint: OK');
            expect(consoleSpy.log).toHaveBeenCalledWith('   tunnel: Failed');
        });
    });

    describe('getResults', () => {
        test('should return current results object', () => {
            const results = checklistLogger.getResults();

            expect(results).toBe(checklistLogger.results);
            expect(results.session).toBe('test-session-123');
        });
    });
});