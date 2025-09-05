const { DatabaseManager } = require('../../src/database/DatabaseManager.cjs');
const fs = require('fs');
const path = require('path');

describe('DatabaseManager', () => {
  let db;
  const testDbPath = path.join(__dirname, '../fixtures/test.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new DatabaseManager(testDbPath);
    db.init();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Project Management', () => {
    test('should create a new project', () => {
      const projectData = {
        name: 'test-project',
        github_repo: 'user/test-project',
        production_url: 'https://test.com',
        deploy_path: '/var/www/test',
        main_branch: 'main'
      };

      const result = db.upsertProject(projectData);
      expect(result.changes).toBeGreaterThan(0);

      const savedProject = db.getProject('test-project');
      expect(savedProject).toBeTruthy();
      expect(savedProject.name).toBe('test-project');
      expect(savedProject.github_repo).toBe('user/test-project');
      expect(savedProject.production_url).toBe('https://test.com');
    });

    test('should update existing project', () => {
      const projectData = {
        name: 'test-project',
        github_repo: 'user/test-project',
        production_url: 'https://test.com',
        deploy_path: '/var/www/test'
      };

      // Create project
      db.upsertProject(projectData);

      // Update project
      const updatedData = {
        ...projectData,
        production_url: 'https://updated.com'
      };
      
      db.upsertProject(updatedData);

      const savedProject = db.getProject('test-project');
      expect(savedProject.production_url).toBe('https://updated.com');
    });

    test('should find project by GitHub repo', () => {
      const projectData = {
        name: 'test-project',
        github_repo: 'user/test-project',
        production_url: 'https://test.com',
        deploy_path: '/var/www/test'
      };

      db.upsertProject(projectData);

      const foundProject = db.getProjectByRepo('user/test-project');
      expect(foundProject).toBeTruthy();
      expect(foundProject.name).toBe('test-project');
    });

    test('should get all active projects', () => {
      const projects = [
        {
          name: 'project1',
          github_repo: 'user/project1',
          production_url: 'https://p1.com',
          deploy_path: '/var/www/p1'
        },
        {
          name: 'project2',
          github_repo: 'user/project2',
          production_url: 'https://p2.com',
          deploy_path: '/var/www/p2'
        }
      ];

      projects.forEach(p => db.upsertProject(p));

      const allProjects = db.getAllProjects();
      expect(allProjects).toHaveLength(2);
      expect(allProjects.map(p => p.name)).toContain('project1');
      expect(allProjects.map(p => p.name)).toContain('project2');
    });

    test('should deactivate project', () => {
      const projectData = {
        name: 'test-project',
        github_repo: 'user/test-project',
        production_url: 'https://test.com',
        deploy_path: '/var/www/test'
      };

      db.upsertProject(projectData);
      
      const deleted = db.deleteProject('test-project');
      expect(deleted).toBe(true);

      const foundProject = db.getProject('test-project');
      expect(foundProject).toBeFalsy();
    });
  });

  describe('Deployment Management', () => {
    let projectId;

    beforeEach(() => {
      const projectData = {
        name: 'test-project',
        github_repo: 'user/test-project',
        production_url: 'https://test.com',
        deploy_path: '/var/www/test'
      };

      db.upsertProject(projectData);
      const project = db.getProject('test-project');
      projectId = project.id;
    });

    test('should create deployment', () => {
      const deploymentData = {
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        branch: 'main'
      };

      const deploymentId = db.createDeployment(projectId, deploymentData);
      expect(deploymentId).toBeTruthy();

      const deployment = db.getDeployment(deploymentId);
      expect(deployment).toBeTruthy();
      expect(deployment.commit_hash).toBe('abc123');
      expect(deployment.status).toBe('pending');
    });

    test('should update deployment status', () => {
      const deploymentId = db.createDeployment(projectId, {
        commit_hash: 'abc123'
      });

      db.updateDeploymentStatus(deploymentId, 'running', 'validation');
      
      const deployment = db.getDeployment(deploymentId);
      expect(deployment.status).toBe('running');
      expect(deployment.phase).toBe('validation');
    });

    test('should add deployment logs', () => {
      const deploymentId = db.createDeployment(projectId, {
        commit_hash: 'abc123'
      });

      db.addDeploymentLog(deploymentId, 'validation', 'info', 'Starting tests');
      db.addDeploymentLog(deploymentId, 'validation', 'info', 'Tests completed');

      const logs = db.getDeploymentLogs(deploymentId);
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Starting tests');
      expect(logs[1].message).toBe('Tests completed');
    });

    test('should get project deployments', () => {
      // Create multiple deployments
      const deploymentIds = [];
      for (let i = 0; i < 3; i++) {
        const id = db.createDeployment(projectId, {
          commit_hash: `commit${i}`,
          commit_message: `Commit ${i}`
        });
        deploymentIds.push(id);
      }

      const deployments = db.getProjectDeployments(projectId, 10);
      expect(deployments).toHaveLength(3);
      expect(deployments.map(d => d.commit_hash)).toContain('commit0');
    });

    test('should get recent deployments', () => {
      // Create deployment for existing project
      db.createDeployment(projectId, {
        commit_hash: 'recent1'
      });

      // Create another project and deployment
      db.upsertProject({
        name: 'project2',
        github_repo: 'user/project2',
        production_url: 'https://p2.com',
        deploy_path: '/var/www/p2'
      });
      
      const project2 = db.getProject('project2');
      db.createDeployment(project2.id, {
        commit_hash: 'recent2'
      });

      const recentDeployments = db.getRecentDeployments(5);
      expect(recentDeployments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Project Statistics', () => {
    let projectId;

    beforeEach(() => {
      db.upsertProject({
        name: 'stats-project',
        github_repo: 'user/stats-project',
        production_url: 'https://stats.com',
        deploy_path: '/var/www/stats'
      });
      
      const project = db.getProject('stats-project');
      projectId = project.id;
    });

    test('should calculate project stats', () => {
      // Create deployments with different statuses
      const deployment1 = db.createDeployment(projectId, { commit_hash: 'hash1' });
      const deployment2 = db.createDeployment(projectId, { commit_hash: 'hash2' });
      const deployment3 = db.createDeployment(projectId, { commit_hash: 'hash3' });

      db.updateDeploymentStatus(deployment1, 'success');
      db.updateDeploymentStatus(deployment2, 'success');
      db.updateDeploymentStatus(deployment3, 'failed');

      const stats = db.getProjectStats(projectId);
      expect(stats.total_deployments).toBe(3);
      expect(stats.successful_deployments).toBe(2);
      expect(stats.failed_deployments).toBe(1);
    });
  });
});