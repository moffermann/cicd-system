const DependencyChecker = require('../../src/checklist/DependencyChecker.cjs');
const { exec } = require('child_process');

jest.mock('child_process', () => ({
    exec: jest.fn()
}));

const util = require('util');
util.promisify = jest.fn((fn) => fn);

describe('DependencyChecker', () => {
    let dependencyChecker;
    let mockLogger;
    let mockExecAsync;

    beforeEach(() => {
        mockLogger = {
            addIssue: jest.fn()
        };
        
        dependencyChecker = new DependencyChecker(mockLogger);
        mockExecAsync = jest.fn();
        util.promisify.mockReturnValue(mockExecAsync);
        jest.clearAllMocks();
    });

    describe('checkDependencies', () => {
        test('should return perfect score when all dependencies are OK', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // npm ls --depth=0
                .mockResolvedValueOnce(); // ssh -V

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(2);
            expect(result.score.max).toBe(2);
            expect(result.details.npmDependencies).toBe('OK');
            expect(result.details.sshInstalled).toBe('OK');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
        });

        test('should handle npm dependency problems', async () => {
            mockExecAsync
                .mockRejectedValueOnce(new Error('npm WARN missing peer dependency'))
                .mockResolvedValueOnce(); // ssh -V

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(1);
            expect(result.details.npmDependencies).toBe('Hay problemas');
            expect(result.details.sshInstalled).toBe('OK');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Problemas con dependencias npm');
        });

        test('should handle SSH not installed', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // npm ls --depth=0
                .mockRejectedValueOnce(new Error('ssh: command not found'));

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(1);
            expect(result.details.npmDependencies).toBe('OK');
            expect(result.details.sshInstalled).toBe('No instalado');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('SSH no está instalado o no está en PATH');
        });

        test('should handle both dependencies failing', async () => {
            mockExecAsync
                .mockRejectedValueOnce(new Error('npm error'))
                .mockRejectedValueOnce(new Error('ssh error'));

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(0);
            expect(result.details.npmDependencies).toBe('Hay problemas');
            expect(result.details.sshInstalled).toBe('No instalado');
            expect(mockLogger.addIssue).toHaveBeenCalledTimes(2);
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Problemas con dependencias npm');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('SSH no está instalado o no está en PATH');
        });

        test('should handle npm command success with warnings', async () => {
            // npm ls can succeed but still have warnings/issues
            mockExecAsync
                .mockResolvedValueOnce() // npm command succeeds even with warnings
                .mockResolvedValueOnce(); // ssh -V

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(2);
            expect(result.details.npmDependencies).toBe('OK');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
        });

        test('should handle SSH version command variations', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // npm ls
                .mockResolvedValueOnce(); // ssh -V (different SSH implementations return different exit codes)

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(2);
            expect(result.details.sshInstalled).toBe('OK');
        });

        test('should handle timeout errors', async () => {
            mockExecAsync
                .mockRejectedValueOnce(new Error('Command timeout'))
                .mockRejectedValueOnce(new Error('SSH timeout'));

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(0);
            expect(result.details.npmDependencies).toBe('Hay problemas');
            expect(result.details.sshInstalled).toBe('No instalado');
        });

        test('should handle permission errors', async () => {
            mockExecAsync
                .mockRejectedValueOnce(new Error('EACCES: permission denied'))
                .mockResolvedValueOnce(); // ssh works

            const result = await dependencyChecker.checkDependencies();

            expect(result.score.current).toBe(1);
            expect(result.details.npmDependencies).toBe('Hay problemas');
            expect(result.details.sshInstalled).toBe('OK');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Problemas con dependencias npm');
        });
    });
});