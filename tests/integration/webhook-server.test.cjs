const request = require('supertest');
const express = require('express');
const { DatabaseManager } = require('../../src/database/DatabaseManager.cjs');
const WebhookHandler = require('../../src/webhook/WebhookHandler.cjs');
const Logger = require('../../src/utils/Logger.cjs');
const fs = require('fs');
const path = require('path');

describe('Webhook Server Integration', () => {
  let app;
  let db;
  let testDbPath;

  beforeAll(() => {
    // Create test database
    testDbPath = path.join(__dirname, '../fixtures/integration-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new DatabaseManager(testDbPath);
    db.init();

    // Setup test data
    db.upsertProject({
      name: 'test-project',
      github_repo: 'user/test-project',
      production_url: 'https://test-project.com',
      staging_url: 'https://staging-test-project.com',
      deploy_path: '/var/www/test',
      main_branch: 'main',
      webhook_secret: null
    });

    db.upsertProject({
      name: 'secured-project',
      github_repo: 'user/secured-project',
      production_url: 'https://secured-project.com',
      deploy_path: '/var/www/secured',
      main_branch: 'main',
      webhook_secret: 'test-secret'
    });

    // Create Express app
    app = express();
    app.use(express.json());

    const logger = new Logger('TestServer');
    const webhookHandler = new WebhookHandler(db, logger);

    // Setup routes similar to webhook server
    app.get('/health', (req, res) => {
      const projects = db.getAllProjects();
      res.json({
        status: 'ok',
        projects: projects.length,
        server_version: 'test'
      });
    });

    app.get('/api/projects', (req, res) => {
      try {
        const projects = db.getAllProjects();
        res.json({ success: true, projects });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/projects/:name', (req, res) => {
      try {
        const project = db.getProject(req.params.name);
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, project });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/deployments', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const deployments = db.getRecentDeployments(limit);
        res.json({ success: true, deployments });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/webhook', async (req, res) => {
      try {
        // Mock the spawn function to prevent actual deployment
        const originalSpawn = require('child_process').spawn;
        require('child_process').spawn = jest.fn().mockImplementation(() => {
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                // Simulate successful deployment
                setTimeout(() => callback(0), 10);
              }
            })
          };
          return mockProcess;
        });

        const result = await webhookHandler.processWebhook(req);
        
        // Restore original spawn
        require('child_process').spawn = originalSpawn;
        
        res.json(result);
      } catch (error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({
          error: error.message
        });
      }
    });
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.projects).toBe(2);
      expect(response.body.server_version).toBe('test');
    });
  });

  describe('Projects API', () => {
    test('should list all projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.projects.map(p => p.name)).toContain('test-project');
      expect(response.body.projects.map(p => p.name)).toContain('secured-project');
    });

    test('should get specific project', async () => {
      const response = await request(app)
        .get('/api/projects/test-project')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.project.name).toBe('test-project');
      expect(response.body.project.github_repo).toBe('user/test-project');
      expect(response.body.project.production_url).toBe('https://test-project.com');
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('Webhook Processing', () => {
    test('should process valid push webhook', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/test-project',
          name: 'test-project'
        },
        ref: 'refs/heads/main',
        head_commit: {
          id: 'abc123def456',
          message: 'Test deployment commit'
        }
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('deploy');
      expect(response.body.project).toBe('test-project');
      expect(response.body.deployment_id).toBeTruthy();
      expect(response.body.commit).toBe('abc123d');
    });

    test('should ignore push to non-target branch', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/test-project'
        },
        ref: 'refs/heads/feature-branch',
        head_commit: {
          id: 'abc123def456',
          message: 'Feature commit'
        }
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('ignored');
      expect(response.body.message).toContain('not to target branch');
    });

    test('should reject webhook for unknown repository', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/unknown-repo'
        },
        ref: 'refs/heads/main'
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(webhookPayload)
        .expect(404);

      expect(response.body.error).toContain('Project not found for repository: user/unknown-repo');
    });

    test('should handle webhook with valid signature', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/secured-project'
        },
        ref: 'refs/heads/main',
        head_commit: {
          id: 'secure123',
          message: 'Secure deployment'
        }
      };

      // Generate valid signature
      const crypto = require('crypto');
      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.project).toBe('secured-project');
    });

    test('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/secured-project'
        },
        ref: 'refs/heads/main'
      };

      // Generate a valid signature first, then modify it to make it invalid
      const crypto = require('crypto');
      const payload = JSON.stringify(webhookPayload);
      const validSignature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');
      const invalidSignature = validSignature.replace(/.$/, '0'); // Change last character

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', invalidSignature)
        .send(webhookPayload)
        .expect(500);

      expect(response.body.error).toContain('Invalid webhook signature');
    });

    test('should handle pull request webhook', async () => {
      const webhookPayload = {
        repository: {
          full_name: 'user/test-project'
        },
        action: 'opened',
        pull_request: {
          number: 42,
          head: {
            ref: 'feature-branch'
          }
        }
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'pull_request')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('acknowledged');
      expect(response.body.pr_number).toBe(42);
    });

    test('should handle missing repository in webhook payload', async () => {
      const webhookPayload = {
        ref: 'refs/heads/main'
        // repository is missing
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(webhookPayload)
        .expect(500);

      expect(response.body.error).toContain('Missing repository information in payload');
    });
  });

  describe('Deployments API', () => {
    test('should list recent deployments', async () => {
      // First create a deployment
      const webhookPayload = {
        repository: {
          full_name: 'user/test-project'
        },
        ref: 'refs/heads/main',
        head_commit: {
          id: 'deployment-test-123',
          message: 'Test deployment for API'
        }
      };

      await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(webhookPayload)
        .expect(200);

      // Wait a moment for deployment to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now check deployments API
      const response = await request(app)
        .get('/api/deployments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deployments).toBeDefined();
      expect(Array.isArray(response.body.deployments)).toBe(true);
    });
  });
});