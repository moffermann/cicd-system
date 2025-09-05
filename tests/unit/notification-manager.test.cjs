const NotificationManager = require('../../src/notifications/NotificationManager.cjs');

// Mock dependencies
jest.mock('node-notifier', () => ({
    notify: jest.fn((options, callback) => {
        // Simulate successful notification by default
        setTimeout(() => callback(null, 'success', { activationType: 'clicked' }), 10);
    })
}));

describe('NotificationManager', () => {
    let notificationManager;
    let consoleSpy;
    let originalEnv;
    let originalPlatform;

    beforeEach(() => {
        // Save original environment
        originalEnv = process.env;
        originalPlatform = process.platform;
        
        // Reset environment
        process.env = { ...originalEnv };
        delete process.env.ENABLE_WINDOWS_NOTIFICATIONS;
        delete process.env.NOTIFICATION_WEBHOOK_URL;
        
        // Create fresh instance
        notificationManager = new NotificationManager();
        
        // Mock console methods
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(),
            error: jest.spyOn(console, 'error').mockImplementation()
        };
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore environment and console
        process.env = originalEnv;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with default settings', () => {
            const manager = new NotificationManager();
            
            expect(manager.notifications.windows).toBe(true);
            expect(manager.notifications.console).toBe(true);
            expect(manager.notifications.webhook).toBeNull();
        });

        test('should disable Windows notifications when ENABLE_WINDOWS_NOTIFICATIONS is false', () => {
            process.env.ENABLE_WINDOWS_NOTIFICATIONS = 'false';
            const manager = new NotificationManager();
            
            expect(manager.notifications.windows).toBe(false);
        });

        test('should set webhook URL from environment', () => {
            process.env.NOTIFICATION_WEBHOOK_URL = 'https://example.com/webhook';
            const manager = new NotificationManager();
            
            expect(manager.notifications.webhook).toBe('https://example.com/webhook');
        });
    });

    describe('Deployment notification methods', () => {
        const mockDeployment = {
            project: 'test-project',
            commit: 'abc123',
            branch: 'main'
        };

        test('should send deployment started notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            
            await notificationManager.deploymentStarted(mockDeployment);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '🚀 Deployment Started',
                message: `Project: ${mockDeployment.project}\nCommit: ${mockDeployment.commit}\nBranch: ${mockDeployment.branch}`,
                type: 'info',
                deployment: mockDeployment
            });
        });

        test('should send deployment success notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            const deploymentWithDuration = { ...mockDeployment, duration: '30s' };
            
            await notificationManager.deploymentSuccess(deploymentWithDuration);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '✅ Deployment Success',
                message: `Project: ${deploymentWithDuration.project}\nCommit: ${deploymentWithDuration.commit}\nDuration: ${deploymentWithDuration.duration}`,
                type: 'success',
                deployment: deploymentWithDuration
            });
        });

        test('should send deployment failed notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            const deploymentWithError = { ...mockDeployment, error: 'Build failed' };
            
            await notificationManager.deploymentFailed(deploymentWithError);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '❌ Deployment Failed',
                message: `Project: ${deploymentWithError.project}\nCommit: ${deploymentWithError.commit}\nError: ${deploymentWithError.error}`,
                type: 'error',
                deployment: deploymentWithError
            });
        });

        test('should send deployment warning notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            const deploymentWithWarning = { ...mockDeployment, warning: 'Tests skipped' };
            
            await notificationManager.deploymentWarning(deploymentWithWarning);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '⚠️ Deployment Warning',
                message: `Project: ${deploymentWithWarning.project}\nCommit: ${deploymentWithWarning.commit}\nWarning: ${deploymentWithWarning.warning}`,
                type: 'warning',
                deployment: deploymentWithWarning
            });
        });

        test('should handle deployment without duration in success notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            
            await notificationManager.deploymentSuccess(mockDeployment);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '✅ Deployment Success',
                message: `Project: ${mockDeployment.project}\nCommit: ${mockDeployment.commit}\nDuration: N/A`,
                type: 'success',
                deployment: mockDeployment
            });
        });

        test('should handle deployment without error in failed notification', async () => {
            const sendSpy = jest.spyOn(notificationManager, 'send').mockResolvedValue();
            
            await notificationManager.deploymentFailed(mockDeployment);
            
            expect(sendSpy).toHaveBeenCalledWith({
                title: '❌ Deployment Failed',
                message: `Project: ${mockDeployment.project}\nCommit: ${mockDeployment.commit}\nError: Unknown error`,
                type: 'error',
                deployment: mockDeployment
            });
        });
    });

    describe('send()', () => {
        const notification = {
            title: 'Test Notification',
            message: 'Test message',
            type: 'info',
            deployment: { project: 'test' }
        };

        test('should send console notification by default', async () => {
            const consoleMethod = jest.spyOn(notificationManager, 'sendConsole').mockResolvedValue({ success: true });
            
            await notificationManager.send(notification);
            
            expect(consoleMethod).toHaveBeenCalledWith({
                title: notification.title,
                message: notification.message,
                type: notification.type
            });
        });

        test('should send Windows notification on win32 platform', async () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            const windowsMethod = jest.spyOn(notificationManager, 'sendWindows').mockResolvedValue({ success: true });
            
            await notificationManager.send(notification);
            
            expect(windowsMethod).toHaveBeenCalledWith({
                title: notification.title,
                message: notification.message,
                type: notification.type
            });
        });

        test('should not send Windows notification on non-win32 platform', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            const windowsMethod = jest.spyOn(notificationManager, 'sendWindows').mockResolvedValue({ success: true });
            
            await notificationManager.send(notification);
            
            expect(windowsMethod).not.toHaveBeenCalled();
        });

        test('should send webhook notification when configured', async () => {
            notificationManager.notifications.webhook = 'https://example.com/webhook';
            const webhookMethod = jest.spyOn(notificationManager, 'sendWebhook').mockResolvedValue({ success: true });
            
            await notificationManager.send(notification);
            
            expect(webhookMethod).toHaveBeenCalledWith({
                title: notification.title,
                message: notification.message,
                type: notification.type,
                deployment: notification.deployment
            });
        });

        test('should not send Windows notification when disabled', async () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            notificationManager.notifications.windows = false;
            const windowsMethod = jest.spyOn(notificationManager, 'sendWindows').mockResolvedValue({ success: true });
            
            await notificationManager.send(notification);
            
            expect(windowsMethod).not.toHaveBeenCalled();
        });
    });

    describe('sendConsole()', () => {
        test('should send console notification successfully', async () => {
            const result = await notificationManager.sendConsole({
                title: 'Test Title',
                message: 'Test message',
                type: 'info'
            });
            
            expect(result).toEqual({ success: true, channel: 'console' });
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('📢 📘 Test Title'));
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🕐'));
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('📝 Test message'));
        });

        test('should handle multiline messages correctly', async () => {
            await notificationManager.sendConsole({
                title: 'Test Title',
                message: 'Line 1\nLine 2\nLine 3',
                type: 'info'
            });
            
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('📝 Line 1\n   Line 2\n   Line 3'));
        });

        test('should handle console errors gracefully', async () => {
            consoleSpy.log.mockImplementation(() => {
                throw new Error('Console error');
            });
            
            const result = await notificationManager.sendConsole({
                title: 'Test Title',
                message: 'Test message',
                type: 'info'
            });
            
            expect(result.success).toBe(false);
            expect(result.channel).toBe('console');
            expect(result.error).toBeInstanceOf(Error);
            expect(consoleSpy.error).toHaveBeenCalledWith('Console notification failed:', expect.any(Error));
        });
    });

    describe('sendWindows()', () => {
        test('should send Windows notification successfully', async () => {
            const nodeNotifier = require('node-notifier');
            
            const result = await notificationManager.sendWindows({
                title: 'Test Title',
                message: 'Test message',
                type: 'success'
            });
            
            expect(result.success).toBe(true);
            expect(result.channel).toBe('windows');
            expect(nodeNotifier.notify).toHaveBeenCalledWith({
                title: 'Test Title',
                message: 'Test message',
                icon: expect.any(String),
                sound: 'Hero',
                timeout: 10,
                appID: 'CICD-System'
            }, expect.any(Function));
        });

        test('should use different sound for error notifications', async () => {
            const nodeNotifier = require('node-notifier');
            
            await notificationManager.sendWindows({
                title: 'Error Title',
                message: 'Error message',
                type: 'error'
            });
            
            expect(nodeNotifier.notify).toHaveBeenCalledWith(
                expect.objectContaining({
                    sound: 'Basso'
                }),
                expect.any(Function)
            );
        });

        test('should handle notification errors', async () => {
            const nodeNotifier = require('node-notifier');
            nodeNotifier.notify.mockImplementation((options, callback) => {
                setTimeout(() => callback(new Error('Notification failed')), 10);
            });
            
            const result = await notificationManager.sendWindows({
                title: 'Test Title',
                message: 'Test message',
                type: 'info'
            });
            
            expect(result.success).toBe(false);
            expect(result.channel).toBe('windows');
            expect(result.error).toBeInstanceOf(Error);
            expect(consoleSpy.error).toHaveBeenCalledWith('Windows notification failed:', expect.any(Error));
        });

        test('should handle synchronous errors', async () => {
            const nodeNotifier = require('node-notifier');
            nodeNotifier.notify.mockImplementation(() => {
                throw new Error('Sync error');
            });
            
            const result = await notificationManager.sendWindows({
                title: 'Test Title',
                message: 'Test message',
                type: 'info'
            });
            
            expect(result.success).toBe(false);
            expect(result.channel).toBe('windows');
            expect(result.error).toBeInstanceOf(Error);
        });
    });

    describe('sendWebhook()', () => {
        test('should send webhook notification successfully', async () => {
            const deployment = {
                project: 'test-project',
                commit: 'abc123',
                branch: 'main',
                status: 'success',
                phase: 'deployment'
            };
            
            const result = await notificationManager.sendWebhook({
                title: 'Test Title',
                message: 'Test message',
                type: 'success',
                deployment
            });
            
            expect(result).toEqual({ success: true, channel: 'webhook' });
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '📡 Webhook notification payload:',
                expect.stringContaining('"title": "Test Title"')
            );
        });

        test('should handle missing deployment data', async () => {
            const result = await notificationManager.sendWebhook({
                title: 'Test Title',
                message: 'Test message',
                type: 'info',
                deployment: null
            });
            
            expect(result.success).toBe(true);
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '📡 Webhook notification payload:',
                expect.stringContaining('"deployment"')
            );
        });

        test('should handle webhook errors gracefully', async () => {
            consoleSpy.log.mockImplementation(() => {
                throw new Error('Webhook error');
            });
            
            const result = await notificationManager.sendWebhook({
                title: 'Test Title',
                message: 'Test message',
                type: 'info',
                deployment: {}
            });
            
            expect(result.success).toBe(false);
            expect(result.channel).toBe('webhook');
            expect(result.error).toBeInstanceOf(Error);
            expect(consoleSpy.error).toHaveBeenCalledWith('Webhook notification failed:', expect.any(Error));
        });
    });

    describe('Utility methods', () => {
        describe('getEmoji()', () => {
            test('should return correct emojis for each type', () => {
                expect(notificationManager.getEmoji('info')).toBe('📘');
                expect(notificationManager.getEmoji('success')).toBe('🟢');
                expect(notificationManager.getEmoji('error')).toBe('🔴');
                expect(notificationManager.getEmoji('warning')).toBe('🟡');
            });

            test('should return default emoji for unknown type', () => {
                expect(notificationManager.getEmoji('unknown')).toBe('📄');
            });
        });

        describe('getIcon()', () => {
            test('should return icon paths for each type', () => {
                const iconTypes = ['info', 'success', 'error', 'warning'];
                
                iconTypes.forEach(type => {
                    const icon = notificationManager.getIcon(type);
                    expect(icon).toContain('assets');
                    expect(icon).toContain(`${type}.ico`);
                });
            });

            test('should return null for unknown type', () => {
                expect(notificationManager.getIcon('unknown')).toBeNull();
            });
        });
    });

    describe('testNotifications()', () => {
        test('should test all notification types', async () => {
            // Mock all notification methods
            const startedSpy = jest.spyOn(notificationManager, 'deploymentStarted').mockResolvedValue();
            const successSpy = jest.spyOn(notificationManager, 'deploymentSuccess').mockResolvedValue();
            const warningSpy = jest.spyOn(notificationManager, 'deploymentWarning').mockResolvedValue();
            const failedSpy = jest.spyOn(notificationManager, 'deploymentFailed').mockResolvedValue();
            
            // Mock setTimeout to avoid waiting
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((callback) => callback());
            
            await notificationManager.testNotifications();
            
            expect(startedSpy).toHaveBeenCalledWith({
                project: 'cicd-system',
                commit: 'test123',
                branch: 'main',
                status: 'success',
                phase: 'testing'
            });
            
            expect(successSpy).toHaveBeenCalled();
            expect(warningSpy).toHaveBeenCalledWith(expect.objectContaining({
                warning: 'Test warning message'
            }));
            expect(failedSpy).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Test error message'
            }));
            
            expect(consoleSpy.log).toHaveBeenCalledWith('🧪 Testing notification system...\n');
            expect(consoleSpy.log).toHaveBeenCalledWith('✅ Notification system test completed');
            
            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });
    });
});