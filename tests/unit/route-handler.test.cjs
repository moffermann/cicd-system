const RouteHandler = require('../../src/server/RouteHandler.cjs');

describe('RouteHandler', () => {
    let routeHandler;
    let mockDatabase;
    let mockServerConfig;
    let consoleSpy;

    beforeEach(() => {
        // Mock database
        mockDatabase = {
            getAllProjects: jest.fn(() => [
                { id: 1, name: 'test-project', active: true },
                { id: 2, name: 'inactive-project', active: false }
            ]),
            getProjectByName: jest.fn((name) => {
                if (name === 'test-project') {
                    return { id: 1, name: 'test-project', github_repo: 'user/test' };
                }
                return null;
            }),
            getProjectDeployments: jest.fn(() => [
                { id: 1, project_id: 1, status: 'success' }
            ]),
            getRecentDeployments: jest.fn(() => [
                { id: 1, project_name: 'test-project', status: 'success' },
                { id: 2, project_name: 'test-project', status: 'failed' }
            ])
        };

        // Mock server config
        mockServerConfig = {
            getValue: jest.fn((key, defaultValue) => {
                const config = {
                    'enabledFeatures': { logging: true },
                    'cors.enabled': false,
                    'cors.origins': ['*']
                };
                return config[key] || defaultValue;
            }),
            isFeatureEnabled: jest.fn((feature) => {
                return feature === 'logging' || feature === 'admin';
            }),
            getAdminToken: jest.fn(() => 'test-admin-token')
        };

        routeHandler = new RouteHandler(mockDatabase, mockServerConfig);

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

    describe('Health Check', () => {
        test('should return health status successfully', async () => {
            const mockRequest = {};
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleHealthCheck(mockRequest, mockResponse);

            expect(mockResponse.json).toHaveBeenCalledWith({
                status: 'ok',
                timestamp: expect.any(String),
                projects: 2,
                server_version: '2.0.0-multi-project',
                features: { logging: true },
                uptime: expect.any(Number)
            });
        });

        test('should handle health check errors', async () => {
            mockDatabase.getAllProjects.mockImplementation(() => {
                throw new Error('Database error');
            });

            const mockRequest = {};
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleHealthCheck(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                status: 'error',
                message: 'Health check failed',
                timestamp: expect.any(String)
            });
            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Health check failed:', expect.any(Error));
        });
    });

    describe('Projects API', () => {
        test('should get all projects successfully', async () => {
            const mockRequest = {};
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleGetProjects(mockRequest, mockResponse);

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                projects: [
                    { id: 1, name: 'test-project', active: true },
                    { id: 2, name: 'inactive-project', active: false }
                ]
            });
        });

        test('should handle projects fetch error', async () => {
            mockDatabase.getAllProjects.mockImplementation(() => {
                throw new Error('Database error');
            });

            const mockRequest = {};
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleGetProjects(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch projects'
            });
        });

        test('should get single project successfully', async () => {
            const mockRequest = {
                params: { name: 'test-project' }
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleGetProject(mockRequest, mockResponse);

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                project: { id: 1, name: 'test-project', github_repo: 'user/test' }
            });
        });

        test('should return 404 for non-existent project', async () => {
            const mockRequest = {
                params: { name: 'nonexistent' }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleGetProject(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Project not found'
            });
        });

        test('should handle single project fetch error', async () => {
            mockDatabase.getProjectByName.mockImplementation(() => {
                throw new Error('Database error');
            });

            const mockRequest = {
                params: { name: 'test-project' }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleGetProject(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch project'
            });
        });
    });

    describe('Deployments API', () => {
        test('should get all deployments with default pagination', async () => {
            const mockRequest = {
                query: {}
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleGetDeployments(mockRequest, mockResponse);

            expect(mockDatabase.getRecentDeployments).toHaveBeenCalledWith(50, 0);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                deployments: [
                    { id: 1, project_name: 'test-project', status: 'success' },
                    { id: 2, project_name: 'test-project', status: 'failed' }
                ],
                pagination: { limit: 50, offset: 0 }
            });
        });

        test('should get deployments with custom pagination', async () => {
            const mockRequest = {
                query: { limit: '10', offset: '5' }
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleGetDeployments(mockRequest, mockResponse);

            expect(mockDatabase.getRecentDeployments).toHaveBeenCalledWith(10, 5);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                deployments: expect.any(Array),
                pagination: { limit: 10, offset: 5 }
            });
        });

        test('should get project-specific deployments', async () => {
            const mockRequest = {
                query: { project: 'test-project' }
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleGetDeployments(mockRequest, mockResponse);

            expect(mockDatabase.getProjectDeployments).toHaveBeenCalledWith('test-project', 50, 0);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                deployments: [{ id: 1, project_id: 1, status: 'success' }],
                pagination: { limit: 50, offset: 0 }
            });
        });

        test('should handle deployments fetch error', async () => {
            mockDatabase.getRecentDeployments.mockImplementation(() => {
                throw new Error('Database error');
            });

            const mockRequest = { query: {} };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleGetDeployments(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch deployments'
            });
        });
    });

    describe('CI Notification Legacy Endpoint', () => {
        test('should handle CI notification', async () => {
            const mockRequest = {
                body: { message: 'test notification', project: 'test-project' }
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleCiNotification(mockRequest, mockResponse);

            expect(consoleSpy.log).toHaveBeenCalledWith('\n🔔 ===== CI NOTIFICATION RECEIVED =====');
            expect(consoleSpy.log).toHaveBeenCalledWith('📅 Timestamp:', expect.any(String));
            expect(consoleSpy.log).toHaveBeenCalledWith('📦 Payload:', JSON.stringify(mockRequest.body, null, 2));
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: 'Notification received',
                timestamp: expect.any(String)
            });
        });
    });

    describe('Admin Endpoints', () => {
        test('should handle admin status when admin is enabled', async () => {
            const mockRequest = {
                headers: { authorization: 'Bearer test-admin-token' }
            };
            const mockResponse = {
                json: jest.fn()
            };

            await routeHandler.handleAdminStatus(mockRequest, mockResponse);

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                stats: {
                    projects: {
                        total: 2,
                        active: 1
                    },
                    deployments: {
                        recent: 2,
                        lastDeployment: { id: 1, project_name: 'test-project', status: 'success' }
                    },
                    server: {
                        uptime: expect.any(Number),
                        memory: expect.any(Object),
                        version: '2.0.0-multi-project'
                    }
                }
            });
        });

        test('should return 403 when admin is disabled', async () => {
            mockServerConfig.isFeatureEnabled.mockReturnValue(false);
            
            const mockRequest = {};
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleAdminStatus(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Admin features disabled'
            });
        });

        test('should return 401 for invalid admin token', async () => {
            const mockRequest = {
                headers: { authorization: 'Bearer invalid-token' }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleAdminStatus(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Invalid admin token'
            });
        });

        test('should handle admin status errors', async () => {
            mockDatabase.getAllProjects.mockImplementation(() => {
                throw new Error('Database error');
            });

            const mockRequest = {
                headers: { authorization: 'Bearer test-admin-token' }
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            await routeHandler.handleAdminStatus(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to get system status'
            });
        });
    });

    describe('Error and 404 Handlers', () => {
        test('should handle 404 errors', () => {
            const mockRequest = {
                path: '/nonexistent'
            };
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn()
            };

            routeHandler.handleNotFound(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Endpoint not found',
                path: '/nonexistent',
                timestamp: expect.any(String)
            });
        });

        test('should handle server errors', () => {
            const error = new Error('Test error');
            const mockRequest = {};
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn(),
                headersSent: false
            };
            const mockNext = jest.fn();

            routeHandler.handleError(error, mockRequest, mockResponse, mockNext);

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Route error:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Internal server error',
                timestamp: expect.any(String)
            });
        });

        test('should not send response if headers already sent', () => {
            const error = new Error('Test error');
            const mockRequest = {};
            const mockResponse = {
                status: jest.fn(() => mockResponse),
                json: jest.fn(),
                headersSent: true
            };
            const mockNext = jest.fn();

            routeHandler.handleError(error, mockRequest, mockResponse, mockNext);

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Route error:', error);
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
        });
    });

    describe('Request Logging', () => {
        test('should log requests when logging is enabled', () => {
            const mockRequest = {
                method: 'GET',
                path: '/api/projects'
            };
            const mockResponse = {};
            const mockNext = jest.fn();

            routeHandler.logRequest(mockRequest, mockResponse, mockNext);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/📡 \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z - GET \/api\/projects/)
            );
            expect(mockNext).toHaveBeenCalled();
        });

        test('should not log when logging is disabled', () => {
            mockServerConfig.isFeatureEnabled.mockReturnValue(false);
            
            const mockRequest = {
                method: 'POST',
                path: '/webhook'
            };
            const mockResponse = {};
            const mockNext = jest.fn();

            routeHandler.logRequest(mockRequest, mockResponse, mockNext);

            expect(consoleSpy.log).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
    });
});