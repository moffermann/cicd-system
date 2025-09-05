const Logger = require('../../src/utils/Logger.cjs');

describe('Logger', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
        logger = new Logger('test-component');
        
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(),
            error: jest.spyOn(console, 'error').mockImplementation(),
            warn: jest.spyOn(console, 'warn').mockImplementation()
        };
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
        consoleSpy.warn.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with component name', () => {
            expect(logger.component).toBe('test-component');
        });

        test('should work without component name', () => {
            const simpleLogger = new Logger();
            expect(simpleLogger.component).toBe('Logger');
        });
    });

    describe('Logging methods', () => {
        test('should log info message', () => {
            logger.info('Test info message');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\] Test info message/)
            );
        });

        test('should log error message', () => {
            logger.error('Test error message');
            
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\] Test error message/)
            );
        });

        test('should log warning message', () => {
            logger.warn('Test warning message');
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\] Test warning message/)
            );
        });

        test('should handle undefined messages', () => {
            logger.info(undefined);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\] undefined/)
            );
        });

        test('should handle null messages', () => {
            logger.error(null);
            
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\] null/)
            );
        });

        test('should handle object messages', () => {
            const testObj = { key: 'value', number: 42 };
            logger.info(testObj);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[test-component\].*key.*value/)
            );
        });

        test('should include timestamp in logs', () => {
            logger.info('Timestamp test');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
            );
        });
    });

    describe('Different component names', () => {
        test('should work with different component names', () => {
            const dbLogger = new Logger('Database');
            const serverLogger = new Logger('Server');
            
            dbLogger.info('Database message');
            serverLogger.error('Server error');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[Database\] Database message/)
            );
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringMatching(/\[Server\] Server error/)
            );
        });

        test('should handle empty component name', () => {
            const emptyLogger = new Logger('');
            emptyLogger.info('Empty component test');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/\[\] Empty component test/)
            );
        });

        test('should handle special characters in component name', () => {
            const specialLogger = new Logger('Test-Component_123!@#');
            specialLogger.warn('Special characters test');
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringMatching(/\[Test-Component_123!@#\] Special characters test/)
            );
        });
    });

    describe('Message formatting', () => {
        test('should handle multiline messages', () => {
            const multilineMessage = 'Line 1\nLine 2\nLine 3';
            logger.info(multilineMessage);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Line 1\nLine 2\nLine 3')
            );
        });

        test('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            logger.error(longMessage);
            
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining(longMessage)
            );
        });
    });
});