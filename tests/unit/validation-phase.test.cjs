// Mock execSync before importing
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

const ValidationPhase = require('../../src/deployment/ValidationPhase.cjs');
const { execSync } = require('child_process');

describe('ValidationPhase', () => {
    let validationPhase;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            logPhase: jest.fn(),
            logProgress: jest.fn(),
            logSuccess: jest.fn(),
            logWarning: jest.fn(),
            logError: jest.fn(),
            logInfo: jest.fn()
        };

        validationPhase = new ValidationPhase(mockLogger);
        
        // Clear mocks but keep the mock implementations
        mockLogger.logPhase.mockClear();
        mockLogger.logProgress.mockClear();
        mockLogger.logSuccess.mockClear();
        mockLogger.logWarning.mockClear();
        mockLogger.logError.mockClear();
        mockLogger.logInfo.mockClear();
        execSync.mockClear();
    });

    describe('Constructor', () => {
        test('should initialize with logger and default validations', () => {
            expect(validationPhase.logger).toBe(mockLogger);
            expect(validationPhase.validations).toHaveLength(4);
            expect(validationPhase.validations[0].name).toBe('Unit Tests');
        });
    });

    describe('execute()', () => {
        test('should execute all validations successfully', async () => {
            execSync.mockReturnValue('test output');

            const result = await validationPhase.execute();

            expect(mockLogger.logPhase).toHaveBeenCalledWith('FASE 1', 'Ejecutando pre-validación local...');
            expect(execSync).toHaveBeenCalledTimes(4);
            expect(mockLogger.logSuccess).toHaveBeenCalledTimes(4);
            expect(result.passed).toBe(4);
            expect(result.failed).toBe(0);
        });

        test('should handle optional validation failures gracefully', async () => {
            execSync.mockImplementation((command) => {
                if (command === 'npm test') {
                    throw new Error('Tests failed');
                }
                return 'success';
            });

            const result = await validationPhase.execute();

            expect(mockLogger.logWarning).toHaveBeenCalledWith(
                expect.stringContaining('Unit Tests falló: Tests failed (opcional - continuando)')
            );
            expect(result.passed).toBe(3);
            expect(result.failed).toBe(0);
        });

        test('should fail when required validations fail', async () => {
            // Make first validation required
            validationPhase.setRequired(['Unit Tests']);
            
            execSync.mockImplementation((command) => {
                if (command === 'npm test') {
                    throw new Error('Tests failed');
                }
                return 'success';
            });

            await expect(validationPhase.execute()).rejects.toThrow('Pre-validación falló');
            expect(mockLogger.logError).toHaveBeenCalledWith(
                expect.stringContaining('Unit Tests falló: Tests failed')
            );
        });

        test('should count results correctly with mixed outcomes', async () => {
            execSync.mockImplementation((command) => {
                if (command.includes('test')) {
                    throw new Error('Tests failed');
                } else if (command.includes('lint')) {
                    throw new Error('Linting failed');
                }
                return 'success';
            });

            const result = await validationPhase.execute();

            expect(result.passed).toBe(2);
            expect(result.failed).toBe(0); // All are optional by default
            expect(mockLogger.logInfo).toHaveBeenCalledWith('Pre-validación completada: 2 exitosos, 0 fallidos');
        });
    });

    describe('addValidation()', () => {
        test('should add custom validation', () => {
            const initialCount = validationPhase.validations.length;
            
            validationPhase.addValidation('Custom Test', 'npm run custom', false);
            
            expect(validationPhase.validations).toHaveLength(initialCount + 1);
            expect(validationPhase.validations[initialCount]).toEqual({
                name: 'Custom Test',
                command: 'npm run custom',
                optional: false
            });
        });

        test('should add optional validation by default', () => {
            validationPhase.addValidation('Optional Test', 'npm run optional');
            
            const lastValidation = validationPhase.validations[validationPhase.validations.length - 1];
            expect(lastValidation.optional).toBe(true);
        });
    });

    describe('setRequired()', () => {
        test('should mark specified validations as required', () => {
            validationPhase.setRequired(['Unit Tests', 'Linting']);
            
            const unitTest = validationPhase.validations.find(v => v.name === 'Unit Tests');
            const linting = validationPhase.validations.find(v => v.name === 'Linting');
            const typeCheck = validationPhase.validations.find(v => v.name === 'Type Check');
            
            expect(unitTest.optional).toBe(false);
            expect(linting.optional).toBe(false);
            expect(typeCheck.optional).toBe(true);
        });

        test('should handle empty required list', () => {
            validationPhase.setRequired([]);
            
            validationPhase.validations.forEach(validation => {
                expect(validation.optional).toBe(true);
            });
        });

        test('should handle non-existent validation names', () => {
            validationPhase.setRequired(['Non-existent Test']);
            
            // Should not throw error, just make all existing validations optional
            validationPhase.validations.forEach(validation => {
                expect(validation.optional).toBe(true);
            });
        });
    });

    describe('Integration scenarios', () => {
        test('should handle mixed required and optional validations', async () => {
            validationPhase.setRequired(['Unit Tests']);
            
            execSync.mockImplementation((command) => {
                if (command === 'npm test') {
                    return 'Tests passed';
                } else if (command === 'npm run lint') {
                    throw new Error('Linting failed');
                }
                return 'success';
            });

            const result = await validationPhase.execute();
            
            expect(result.passed).toBe(3); // Test passes, others pass
            expect(result.failed).toBe(0);  // Linting failure is optional
            expect(mockLogger.logWarning).toHaveBeenCalledWith(
                expect.stringContaining('Linting falló')
            );
        });

        test('should execute validations in order', async () => {
            execSync.mockReturnValue('success');
            
            await validationPhase.execute();
            
            const progressCalls = mockLogger.logProgress.mock.calls;
            expect(progressCalls[0][0]).toContain('Unit Tests');
            expect(progressCalls[1][0]).toContain('Linting');
            expect(progressCalls[2][0]).toContain('Type Check');
            expect(progressCalls[3][0]).toContain('Security Scan');
        });

        test('should continue execution even when optional validations fail', async () => {
            execSync.mockImplementation((command) => {
                throw new Error(`${command} failed`);
            });

            const result = await validationPhase.execute();
            
            // All validations are optional by default, so should complete
            expect(result.passed).toBe(0);
            expect(result.failed).toBe(0);
            expect(mockLogger.logWarning).toHaveBeenCalledTimes(4);
        });
    });
});