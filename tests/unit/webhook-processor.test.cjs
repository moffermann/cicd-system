const WebhookProcessor = require('../../src/server/WebhookProcessor.cjs');

// Mock dependencies
jest.mock('../../src/webhook/WebhookHandler.cjs', () => {
    return jest.fn().mockImplementation(() => ({
        verifySignature: jest.fn(() => true)
    }));
});

describe('WebhookProcessor', () => {
    let webhookProcessor;
    let mockDatabase;
    let mockNotificationManager;
    let consoleSpy;

    beforeEach(() => {
        // Mock database
        mockDatabase = {
            getProjectByRepo: jest.fn((repo) => {
                if (repo === 'user/test-repo') {
                    return {
                        id: 1,
                        name: 'test-project',
                        main_branch: 'main',
                        github_repo: 'user/test-repo',
                        webhook_secret: 'secret123',
                        environment: 'production'
                    };
                }
                return null;
            }),
            createDeployment: jest.fn(() => Promise.resolve(123)),
            updateDeploymentStatus: jest.fn(() => Promise.resolve())
        };

        // Mock notification manager
        mockNotificationManager = {
            sendDeploymentNotification: jest.fn(() => Promise.resolve())
        };

        webhookProcessor = new WebhookProcessor(mockDatabase, mockNotificationManager);

        // Mock console
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
        test('should initialize with database and notification manager', () => {
            expect(webhookProcessor.db).toBe(mockDatabase);
            expect(webhookProcessor.notificationManager).toBe(mockNotificationManager);
            expect(webhookProcessor.activeDeployments).toBeInstanceOf(Map);
        });

        test('should work without notification manager', () => {
            const processor = new WebhookProcessor(mockDatabase);
            expect(processor.notificationManager).toBeNull();
        });
    });

    describe('processWebhook()', () => {
        test('should process valid webhook successfully', async () => {
            const mockRequest = {
                headers: {
                    'x-github-event': 'push',
                    'x-hub-signature-256': 'sha256=valid'
                },
                body: {
                    repository: { full_name: 'user/test-repo' },
                    ref: 'refs/heads/main',
                    head_commit: {
                        id: 'commit123',
                        message: 'Test commit',
                        author: { name: 'Test User' }
                    }
                }
            };
            const mockResponse = {
                json: jest.fn()
            };

            jest.spyOn(webhookProcessor, 'handleWebhookEvent').mockResolvedValue({
                message: 'Deployment started',
                deploymentId: 123
            });

            await webhookProcessor.processWebhook(mockRequest, mockResponse);

            expect(consoleSpy.log).toHaveBeenCalledWith('\n🔔 ===== WEBHOOK RECEIVED =====');
            expect(consoleSpy.log).toHaveBeenCalledWith('📦 Repository:', 'user/test-repo');
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: 'Deployment started',
                deployment_id: 123
            });
        });

        test('should reject webhook with invalid payload', async () => {
            const mockRequest = {
                headers: { 'x-github-event': 'push' },
                body: {} // Missing repository
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await webhookProcessor.processWebhook(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid webhook payload'
            });
        });

        test('should reject webhook for unknown repository', async () => {
            const mockRequest = {
                headers: { 'x-github-event': 'push' },
                body: {
                    repository: { full_name: 'unknown/repo' }
                }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await webhookProcessor.processWebhook(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Repository not configured for deployment'
            });
        });

        test('should verify webhook signature when configured', async () => {
            const WebhookHandler = require('../../src/webhook/WebhookHandler.cjs');
            const mockHandler = new WebhookHandler();
            mockHandler.verifySignature.mockReturnValue(false);
            
            const mockRequest = {
                headers: {
                    'x-github-event': 'push',
                    'x-hub-signature-256': 'sha256=invalid'
                },
                body: {
                    repository: { full_name: 'user/test-repo' }
                }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await webhookProcessor.processWebhook(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Webhook signature verification failed'
            });
        });

        test('should handle processing errors gracefully', async () => {
            const mockRequest = {
                headers: { 'x-github-event': 'push' },
                body: {
                    repository: { full_name: 'user/test-repo' }
                }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            jest.spyOn(webhookProcessor, 'handleWebhookEvent').mockRejectedValue(new Error('Processing failed'));

            await webhookProcessor.processWebhook(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Webhook processing failed',
                error: 'Processing failed'
            });
        });
    });

    describe('handleWebhookEvent()', () => {
        const mockProject = {
            id: 1,
            name: 'test-project',
            main_branch: 'main'
        };

        test('should handle push events', async () => {
            jest.spyOn(webhookProcessor, 'handlePushEvent').mockResolvedValue({
                message: 'Push handled',
                deploymentId: 123
            });

            const result = await webhookProcessor.handleWebhookEvent('push', {}, mockProject);

            expect(webhookProcessor.handlePushEvent).toHaveBeenCalledWith({}, mockProject);
            expect(result.message).toBe('Push handled');
        });

        test('should handle pull request events', async () => {
            jest.spyOn(webhookProcessor, 'handlePullRequestEvent').mockResolvedValue({
                message: 'PR handled'
            });

            const result = await webhookProcessor.handleWebhookEvent('pull_request', {}, mockProject);

            expect(webhookProcessor.handlePullRequestEvent).toHaveBeenCalledWith({}, mockProject);
            expect(result.message).toBe('PR handled');
        });

        test('should handle release events', async () => {
            jest.spyOn(webhookProcessor, 'handleReleaseEvent').mockResolvedValue({
                message: 'Release handled'
            });

            const result = await webhookProcessor.handleWebhookEvent('release', {}, mockProject);

            expect(webhookProcessor.handleReleaseEvent).toHaveBeenCalledWith({}, mockProject);
            expect(result.message).toBe('Release handled');
        });

        test('should ignore unknown events', async () => {
            const result = await webhookProcessor.handleWebhookEvent('unknown', {}, mockProject);

            expect(result.message).toBe('Event unknown ignored');
            expect(result.deploymentId).toBeNull();
        });
    });

    describe('handlePushEvent()', () => {
        const mockProject = {
            id: 1,
            name: 'test-project',
            main_branch: 'main'
        };

        const mockPayload = {
            ref: 'refs/heads/main',
            head_commit: {
                id: 'commit123',
                message: 'Test commit',
                author: { name: 'Test User' }
            }
        };

        test('should start deployment for push to main branch', async () => {
            jest.spyOn(webhookProcessor, 'startDeployment').mockResolvedValue({
                message: 'Deployment started',
                deploymentId: 123
            });

            const result = await webhookProcessor.handlePushEvent(mockPayload, mockProject);

            expect(webhookProcessor.startDeployment).toHaveBeenCalledWith(mockProject, {
                trigger: 'push',
                branch: 'main',
                commit: 'commit123',
                author: 'Test User',
                message: 'Test commit',
                timestamp: expect.any(String)
            });
            expect(result.message).toBe('Deployment started');
        });

        test('should ignore push to non-main branch', async () => {
            const branchPayload = {
                ...mockPayload,
                ref: 'refs/heads/feature-branch'
            };

            const result = await webhookProcessor.handlePushEvent(branchPayload, mockProject);

            expect(result.message).toBe('Push to feature-branch ignored - not main branch');
        });

        test('should ignore push when deployment already in progress', async () => {
            webhookProcessor.activeDeployments.set('test-project', 456);

            const result = await webhookProcessor.handlePushEvent(mockPayload, mockProject);

            expect(result.message).toBe('Deployment already in progress');
        });
    });

    describe('handlePullRequestEvent()', () => {
        const mockProject = { name: 'test-project' };
        const mockPayload = {
            action: 'opened',
            pull_request: {
                number: 42,
                title: 'Test PR'
            }
        };

        test('should handle PR opened event', async () => {
            const result = await webhookProcessor.handlePullRequestEvent(mockPayload, mockProject);

            expect(consoleSpy.log).toHaveBeenCalledWith('📝 Pull request opened: #42 - Test PR');
            expect(result.message).toBe('Pull request opened logged');
        });

        test('should ignore unsupported PR actions', async () => {
            const unsupportedPayload = {
                ...mockPayload,
                action: 'labeled'
            };

            const result = await webhookProcessor.handlePullRequestEvent(unsupportedPayload, mockProject);

            expect(result.message).toBe('PR action labeled ignored');
        });
    });

    describe('handleReleaseEvent()', () => {
        const mockProject = {
            id: 1,
            name: 'test-project',
            main_branch: 'main'
        };

        test('should start deployment for published release', async () => {
            const mockPayload = {
                action: 'published',
                release: {
                    tag_name: 'v1.0.0',
                    target_commitish: 'commit123'
                }
            };

            jest.spyOn(webhookProcessor, 'startDeployment').mockResolvedValue({
                message: 'Release deployment started',
                deploymentId: 789
            });

            const result = await webhookProcessor.handleReleaseEvent(mockPayload, mockProject);

            expect(webhookProcessor.startDeployment).toHaveBeenCalledWith(mockProject, {
                trigger: 'release',
                version: 'v1.0.0',
                branch: 'main',
                commit: 'commit123',
                timestamp: expect.any(String)
            });
            expect(result.message).toBe('Release deployment started');
        });

        test('should log non-published release events', async () => {
            const mockPayload = {
                action: 'created',
                release: { tag_name: 'v1.0.0' }
            };

            const result = await webhookProcessor.handleReleaseEvent(mockPayload, mockProject);

            expect(result.message).toBe('Release created logged');
        });
    });

    describe('startDeployment()', () => {
        const mockProject = {
            id: 1,
            name: 'test-project',
            environment: 'production'
        };

        const mockContext = {
            trigger: 'push',
            branch: 'main',
            commit: 'commit123',
            author: 'Test User'
        };

        test('should create deployment and start execution', async () => {
            jest.spyOn(webhookProcessor, 'executeDeployment').mockResolvedValue();

            const result = await webhookProcessor.startDeployment(mockProject, mockContext);

            expect(mockDatabase.createDeployment).toHaveBeenCalledWith({
                project_name: 'test-project',
                trigger: 'push',
                branch: 'main',
                commit: 'commit123',
                status: 'pending',
                environment: 'production',
                triggered_by: 'Test User',
                metadata: JSON.stringify(mockContext)
            });

            expect(webhookProcessor.activeDeployments.get('test-project')).toBe(123);
            expect(result.message).toBe('Deployment started for test-project');
            expect(result.deploymentId).toBe(123);
        });

        test('should send notification when notification manager available', async () => {
            jest.spyOn(webhookProcessor, 'executeDeployment').mockResolvedValue();

            await webhookProcessor.startDeployment(mockProject, mockContext);

            expect(mockNotificationManager.sendDeploymentNotification).toHaveBeenCalledWith({
                project: 'test-project',
                status: 'started',
                trigger: 'push',
                branch: 'main',
                commit: 'commit123',
                deploymentId: 123
            });
        });

        test('should handle deployment creation errors', async () => {
            mockDatabase.createDeployment.mockRejectedValue(new Error('Database error'));

            await expect(webhookProcessor.startDeployment(mockProject, mockContext))
                .rejects.toThrow('Database error');
        });
    });

    describe('executeDeployment()', () => {
        const mockProject = {
            id: 1,
            name: 'test-project',
            production_url: 'https://test.com'
        };

        beforeEach(() => {
            jest.spyOn(webhookProcessor, 'sleep').mockResolvedValue();
        });

        test('should execute deployment successfully', async () => {
            await webhookProcessor.executeDeployment(mockProject, 123, {});

            expect(mockDatabase.updateDeploymentStatus).toHaveBeenCalledWith(123, 'running', 'Deployment in progress');
            expect(mockDatabase.updateDeploymentStatus).toHaveBeenCalledWith(123, 'success', 'Deployment completed successfully');
            expect(webhookProcessor.activeDeployments.has('test-project')).toBe(false);

            expect(mockNotificationManager.sendDeploymentNotification).toHaveBeenCalledWith({
                project: 'test-project',
                status: 'success',
                deploymentId: 123,
                url: 'https://test.com'
            });
        });

        test('should handle deployment execution errors', async () => {
            mockDatabase.updateDeploymentStatus.mockRejectedValue(new Error('Database error'));

            await expect(webhookProcessor.executeDeployment(mockProject, 123, {}))
                .rejects.toThrow('Database error');

            expect(mockDatabase.updateDeploymentStatus).toHaveBeenCalledWith(123, 'failed', 'Database error');
            expect(mockNotificationManager.sendDeploymentNotification).toHaveBeenCalledWith({
                project: 'test-project',
                status: 'failed',
                deploymentId: 123,
                error: 'Database error'
            });
            expect(webhookProcessor.activeDeployments.has('test-project')).toBe(false);
        });
    });

    describe('Utility methods', () => {
        test('getActiveDeployments() should return active deployments', () => {
            webhookProcessor.activeDeployments.set('project1', 123);
            webhookProcessor.activeDeployments.set('project2', 456);

            const active = webhookProcessor.getActiveDeployments();

            expect(active).toEqual([
                { project: 'project1', deploymentId: 123 },
                { project: 'project2', deploymentId: 456 }
            ]);
        });

        test('cancelDeployment() should cancel active deployment', async () => {
            webhookProcessor.activeDeployments.set('test-project', 123);

            const result = await webhookProcessor.cancelDeployment('test-project');

            expect(result).toBe(true);
            expect(webhookProcessor.activeDeployments.has('test-project')).toBe(false);
            expect(mockDatabase.updateDeploymentStatus).toHaveBeenCalledWith(123, 'cancelled', 'Deployment cancelled');
        });

        test('cancelDeployment() should return false for non-existent deployment', async () => {
            const result = await webhookProcessor.cancelDeployment('nonexistent');

            expect(result).toBe(false);
            expect(mockDatabase.updateDeploymentStatus).not.toHaveBeenCalled();
        });

        test('sleep() should resolve after specified time', async () => {
            // Restore original sleep for this test
            webhookProcessor.sleep.mockRestore();
            
            const start = Date.now();
            await webhookProcessor.sleep(50);
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
        });
    });
});