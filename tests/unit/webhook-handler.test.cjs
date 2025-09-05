const WebhookHandler = require('../../src/webhook/WebhookHandler.cjs');
const Logger = require('../../src/utils/Logger.cjs');

describe('WebhookHandler', () => {
  let webhookHandler;
  let mockDb;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn()
    };

    // Mock database
    mockDb = {
      getProjectByRepo: jest.fn(),
      getAllProjects: jest.fn(),
      createDeployment: jest.fn(),
      updateDeploymentStatus: jest.fn(),
      addDeploymentLog: jest.fn()
    };

    webhookHandler = new WebhookHandler(mockDb, mockLogger);
  });

  describe('Webhook Signature Verification', () => {
    test('should verify valid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const signature = 'sha256=4864d2759938da4ff53cf73ddc1c5a4d5c15b8b7b1e4f7b1a1b4c5d2e3f4g5h6';
      
      // Generate actual signature for test
      const crypto = require('crypto');
      const actualSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      
      const isValid = webhookHandler.verifyWebhookSignature(payload, actualSignature, secret);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      
      // Generate a valid signature first, then modify it to make it invalid
      const crypto = require('crypto');
      const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const invalidSignature = validSignature.replace(/.$/, '0'); // Change last character
      
      const isValid = webhookHandler.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    test('should return false for missing signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      
      const isValid = webhookHandler.verifyWebhookSignature(payload, null, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('Process Webhook', () => {
    const mockProject = {
      id: 1,
      name: 'test-project',
      github_repo: 'user/test-repo',
      production_url: 'https://test.com',
      main_branch: 'main',
      webhook_secret: null
    };

    const mockRequest = {
      headers: {
        'x-github-event': 'push',
        'x-hub-signature-256': 'sha256=test'
      },
      body: {
        repository: {
          full_name: 'user/test-repo',
          name: 'test-repo'
        },
        ref: 'refs/heads/main',
        head_commit: {
          id: 'abc123def456',
          message: 'Test commit'
        }
      }
    };

    test('should process push webhook successfully', async () => {
      mockDb.getProjectByRepo.mockReturnValue(mockProject);
      mockDb.createDeployment.mockReturnValue(1);

      // Mock spawn to prevent actual deployment
      const originalSpawn = require('child_process').spawn;
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      }));
      require('child_process').spawn = mockSpawn;

      const result = await webhookHandler.processWebhook(mockRequest);

      expect(result.success).toBe(true);
      expect(result.action).toBe('deploy');
      expect(result.project).toBe('test-project');
      expect(mockDb.getProjectByRepo).toHaveBeenCalledWith('user/test-repo');
      expect(mockDb.createDeployment).toHaveBeenCalled();

      // Restore original spawn
      require('child_process').spawn = originalSpawn;
    });

    test('should reject webhook for unknown repository', async () => {
      mockDb.getProjectByRepo.mockReturnValue(null);
      mockDb.getAllProjects.mockReturnValue([]);

      await expect(webhookHandler.processWebhook(mockRequest))
        .rejects
        .toThrow('Project not found for repository: user/test-repo');

      expect(mockDb.getProjectByRepo).toHaveBeenCalledWith('user/test-repo');
    });

    test('should ignore push to non-target branch', async () => {
      const requestWithWrongBranch = {
        ...mockRequest,
        body: {
          ...mockRequest.body,
          ref: 'refs/heads/feature-branch'
        }
      };

      mockDb.getProjectByRepo.mockReturnValue(mockProject);

      const result = await webhookHandler.processWebhook(requestWithWrongBranch);

      expect(result.success).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.message).toContain('not to target branch');
      expect(mockDb.createDeployment).not.toHaveBeenCalled();
    });

    test('should handle missing repository in payload', async () => {
      const requestWithoutRepo = {
        ...mockRequest,
        body: {
          ref: 'refs/heads/main'
          // repository is missing
        }
      };

      await expect(webhookHandler.processWebhook(requestWithoutRepo))
        .rejects
        .toThrow('Missing repository information in payload');
    });

    test('should verify webhook signature when secret is provided', async () => {
      const projectWithSecret = {
        ...mockProject,
        webhook_secret: 'test-secret'
      };

      const payload = JSON.stringify(mockRequest.body);
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');

      const requestWithSignature = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-hub-signature-256': signature
        }
      };

      mockDb.getProjectByRepo.mockReturnValue(projectWithSecret);
      mockDb.createDeployment.mockReturnValue(1);

      // Mock spawn
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      }));
      require('child_process').spawn = mockSpawn;

      const result = await webhookHandler.processWebhook(requestWithSignature);

      expect(result.success).toBe(true);
      expect(mockLogger.log).toHaveBeenCalledWith('✅ Webhook signature verified');
    });
  });

  describe('Process Events', () => {
    const mockProject = {
      id: 1,
      name: 'test-project',
      main_branch: 'main'
    };

    test('should handle pull request events', async () => {
      const pullRequestPayload = {
        action: 'opened',
        pull_request: {
          number: 123,
          head: {
            ref: 'feature-branch'
          }
        }
      };

      const result = await webhookHandler.processEvent('pull_request', pullRequestPayload, mockProject);

      expect(result.success).toBe(true);
      expect(result.action).toBe('acknowledged');
      expect(result.pr_number).toBe(123);
    });

    test('should handle unknown events', async () => {
      const result = await webhookHandler.processEvent('unknown_event', {}, mockProject);

      expect(result.success).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.message).toContain('not handled');
    });
  });

  describe('Build Deployment Environment', () => {
    test('should build correct environment variables', () => {
      const project = {
        id: 1,
        name: 'test-project',
        production_url: 'https://test.com',
        staging_url: 'https://staging-test.com',
        github_repo: 'user/test-repo',
        deploy_path: '/var/www/test',
        main_branch: 'main',
        webhook_secret: 'secret',
        deployment_timeout: 600000
      };

      const webhookPayload = {
        head_commit: {
          id: 'abc123def456',
          message: 'Test commit message'
        }
      };

      const env = webhookHandler.buildDeploymentEnvironment(project, 123, webhookPayload);

      expect(env.PROJECT_NAME).toBe('test-project');
      expect(env.PRODUCTION_URL).toBe('https://test.com');
      expect(env.STAGING_URL).toBe('https://staging-test.com');
      expect(env.GITHUB_REPO).toBe('user/test-repo');
      expect(env.DEPLOYMENT_ID).toBe('123');
      expect(env.DEPLOY_PATH).toBe('/var/www/test');
      expect(env.MAIN_BRANCH).toBe('main');
      expect(env.WEBHOOK_SECRET).toBe('secret');
      expect(env.COMMIT_HASH).toBe('abc123def456');
      expect(env.COMMIT_MESSAGE).toBe('Test commit message');
      expect(env.DEPLOYMENT_TIMEOUT).toBe('600000');
    });
  });
});