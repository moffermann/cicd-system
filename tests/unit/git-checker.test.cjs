const GitChecker = require('../../src/checklist/GitChecker.cjs');
const { exec } = require('child_process');

jest.mock('child_process', () => ({
    exec: jest.fn()
}));

const util = require('util');
util.promisify = jest.fn((fn) => fn);

describe('GitChecker', () => {
    let gitChecker;
    let mockLogger;
    let mockExecAsync;

    beforeEach(() => {
        mockLogger = {
            addIssue: jest.fn()
        };
        
        gitChecker = new GitChecker(mockLogger);
        mockExecAsync = jest.fn();
        util.promisify.mockReturnValue(mockExecAsync);
        jest.clearAllMocks();
    });

    describe('checkRepository', () => {
        test('should return perfect score for clean main branch', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: '' }) // git status --porcelain
                .mockResolvedValueOnce({ stdout: 'main\n' }); // git branch --show-current

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(3);
            expect(result.score.max).toBe(3);
            expect(result.details.repository).toBe('OK');
            expect(result.details.uncommittedChanges).toBe('Ninguno');
            expect(result.details.currentBranch).toBe('main');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
        });

        test('should return perfect score for clean master branch', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: '' }) // git status --porcelain
                .mockResolvedValueOnce({ stdout: 'master\n' }); // git branch --show-current

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(3);
            expect(result.details.currentBranch).toBe('master');
            expect(mockLogger.addIssue).not.toHaveBeenCalled();
        });

        test('should handle uncommitted changes', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: 'M modified-file.js\n?? new-file.js\n' }) // git status --porcelain
                .mockResolvedValueOnce({ stdout: 'main\n' }); // git branch --show-current

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(2); // Repository OK + branch OK, changes not OK
            expect(result.details.uncommittedChanges).toBe('Hay cambios sin commit');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Hay cambios sin commit en el repositorio');
        });

        test('should handle feature branch', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: '' }) // git status --porcelain
                .mockResolvedValueOnce({ stdout: 'feature/new-feature\n' }); // git branch --show-current

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(2); // Repository OK + no changes, branch not main/master
            expect(result.details.currentBranch).toBe('feature/new-feature');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Rama actual no es master/main: feature/new-feature');
        });

        test('should handle git repository errors', async () => {
            const error = new Error('not a git repository');
            mockExecAsync.mockRejectedValueOnce(error);

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(0);
            expect(result.details.repository).toBe('ERROR - not a git repository');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('No se puede acceder al repositorio Git');
        });

        test('should handle mixed scenarios - repo OK but other issues', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status OK
                .mockResolvedValueOnce({ stdout: 'A staged-file.js\n' }) // Has staged changes
                .mockResolvedValueOnce({ stdout: 'develop\n' }); // Wrong branch

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(1); // Only repository check passes
            expect(result.details.repository).toBe('OK');
            expect(result.details.uncommittedChanges).toBe('Hay cambios sin commit');
            expect(result.details.currentBranch).toBe('develop');
            expect(mockLogger.addIssue).toHaveBeenCalledTimes(2);
        });

        test('should handle empty branch name', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: '' }) // git status --porcelain
                .mockResolvedValueOnce({ stdout: '\n' }); // empty branch name

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(2);
            expect(result.details.currentBranch).toBe('');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('Rama actual no es master/main: ');
        });

        test('should handle branch command failure', async () => {
            mockExecAsync
                .mockResolvedValueOnce() // git status
                .mockResolvedValueOnce({ stdout: '' }) // git status --porcelain
                .mockRejectedValueOnce(new Error('No branch found')); // branch command fails

            const result = await gitChecker.checkRepository();

            expect(result.score.current).toBe(0);
            expect(result.details.repository).toBe('ERROR - No branch found');
            expect(mockLogger.addIssue).toHaveBeenCalledWith('No se puede acceder al repositorio Git');
        });
    });
});