const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * DatabaseManager - SQLite database management for CI/CD system
 * 
 * Manages:
 * - Project configurations
 * - Deployment history
 * - System settings
 */
class DatabaseManager {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(process.cwd(), 'data', 'cicd-system.db');
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize database connection and create tables
     */
    init() {
        try {
            // Ensure data directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Connect to database
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL'); // Better performance
            this.db.pragma('foreign_keys = ON');   // Enable foreign keys

            console.log(`🗄️ Database connected: ${this.dbPath}`);

            // Run migrations
            this.runMigrations();
            
            this.isInitialized = true;
            console.log('✅ Database initialized successfully');

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Run database migrations
     */
    runMigrations() {
        // Create projects table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                github_repo TEXT NOT NULL,
                production_url TEXT NOT NULL,
                staging_url TEXT,
                deploy_path TEXT NOT NULL,
                main_branch TEXT DEFAULT 'main',
                webhook_secret TEXT,
                port INTEGER DEFAULT 3000,
                environment TEXT DEFAULT 'production',
                health_check_interval INTEGER DEFAULT 30000,
                deployment_timeout INTEGER DEFAULT 600000,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create deployments table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS deployments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                commit_hash TEXT,
                commit_message TEXT,
                branch TEXT,
                status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'cancelled'
                phase TEXT, -- 'validation', 'staging', 'pre-production', 'production', 'monitoring'
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                duration_ms INTEGER,
                logs TEXT,
                error_message TEXT,
                triggered_by TEXT DEFAULT 'webhook',
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        // Create deployment_logs table for detailed logging
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS deployment_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deployment_id INTEGER NOT NULL,
                phase TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'debug'
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
            CREATE INDEX IF NOT EXISTS idx_projects_github_repo ON projects(github_repo);
            CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
            CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
            CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
        `);

        console.log('📊 Database schema created/updated');
    }

    /**
     * Project Management Methods
     */

    // Create or update project
    upsertProject(projectData) {
        const {
            name, github_repo, production_url, staging_url, deploy_path,
            main_branch = 'main', webhook_secret = null, port = 3000,
            environment = 'production', health_check_interval = 30000,
            deployment_timeout = 600000, active = 1
        } = projectData;

        const stmt = this.db.prepare(`
            INSERT INTO projects (
                name, github_repo, production_url, staging_url, deploy_path,
                main_branch, webhook_secret, port, environment,
                health_check_interval, deployment_timeout, active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(name) DO UPDATE SET
                github_repo = excluded.github_repo,
                production_url = excluded.production_url,
                staging_url = excluded.staging_url,
                deploy_path = excluded.deploy_path,
                main_branch = excluded.main_branch,
                webhook_secret = excluded.webhook_secret,
                port = excluded.port,
                environment = excluded.environment,
                health_check_interval = excluded.health_check_interval,
                deployment_timeout = excluded.deployment_timeout,
                active = excluded.active,
                updated_at = CURRENT_TIMESTAMP
        `);

        const result = stmt.run(
            name, github_repo, production_url, staging_url, deploy_path,
            main_branch, webhook_secret, port, environment,
            health_check_interval, deployment_timeout, active
        );

        console.log(`💾 Project ${name} ${result.changes > 0 ? 'updated' : 'created'}`);
        return result;
    }

    // Get project by name
    getProject(name) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE name = ? AND active = 1');
        return stmt.get(name);
    }

    // Get project by GitHub repo
    getProjectByRepo(githubRepo) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE github_repo = ? AND active = 1');
        return stmt.get(githubRepo);
    }

    // Get all active projects
    getAllProjects() {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE active = 1 ORDER BY name');
        return stmt.all();
    }

    // Delete project
    deleteProject(name) {
        const stmt = this.db.prepare('UPDATE projects SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE name = ?');
        const result = stmt.run(name);
        console.log(`🗑️ Project ${name} deactivated`);
        return result.changes > 0;
    }

    /**
     * Deployment Management Methods
     */

    // Create new deployment
    createDeployment(projectId, deploymentData = {}) {
        const {
            commit_hash = null,
            commit_message = null,
            branch = null,
            triggered_by = 'webhook'
        } = deploymentData;

        const stmt = this.db.prepare(`
            INSERT INTO deployments (
                project_id, commit_hash, commit_message, branch, 
                status, triggered_by
            ) VALUES (?, ?, ?, ?, 'pending', ?)
        `);

        const result = stmt.run(projectId, commit_hash, commit_message, branch, triggered_by);
        console.log(`🚀 Deployment ${result.lastInsertRowid} created for project ${projectId}`);
        return result.lastInsertRowid;
    }

    // Update deployment status
    updateDeploymentStatus(deploymentId, status, phase = null, errorMessage = null) {
        const completed = ['success', 'failed', 'cancelled'].includes(status);
        
        let sql = `
            UPDATE deployments 
            SET status = ?
        `;
        let params = [status];

        if (phase) {
            sql += ', phase = ?';
            params.push(phase);
        }

        if (completed) {
            sql += ', completed_at = CURRENT_TIMESTAMP';
        }

        if (errorMessage) {
            sql += ', error_message = ?';
            params.push(errorMessage);
        }

        sql += ' WHERE id = ?';
        params.push(deploymentId);

        const stmt = this.db.prepare(sql);
        stmt.run(...params);
        
        console.log(`📝 Deployment ${deploymentId} status: ${status}${phase ? ` (${phase})` : ''}`);
    }

    // Get deployment by ID
    getDeployment(id) {
        const stmt = this.db.prepare(`
            SELECT d.*, p.name as project_name 
            FROM deployments d 
            JOIN projects p ON d.project_id = p.id 
            WHERE d.id = ?
        `);
        return stmt.get(id);
    }

    // Get recent deployments for project
    getProjectDeployments(projectId, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM deployments 
            WHERE project_id = ? 
            ORDER BY started_at DESC 
            LIMIT ?
        `);
        return stmt.all(projectId, limit);
    }

    // Get all recent deployments
    getRecentDeployments(limit = 20) {
        const stmt = this.db.prepare(`
            SELECT d.*, p.name as project_name 
            FROM deployments d 
            JOIN projects p ON d.project_id = p.id 
            ORDER BY d.started_at DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // Add deployment log
    addDeploymentLog(deploymentId, phase, level, message) {
        const stmt = this.db.prepare(`
            INSERT INTO deployment_logs (deployment_id, phase, level, message)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(deploymentId, phase, level, message);
    }

    // Get deployment logs
    getDeploymentLogs(deploymentId) {
        const stmt = this.db.prepare(`
            SELECT * FROM deployment_logs 
            WHERE deployment_id = ? 
            ORDER BY timestamp ASC
        `);
        return stmt.all(deploymentId);
    }

    /**
     * Statistics and Monitoring
     */

    getProjectStats(projectId) {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total_deployments,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_deployments,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_deployments,
                AVG(duration_ms) as avg_duration_ms,
                MAX(started_at) as last_deployment
            FROM deployments 
            WHERE project_id = ?
        `).get(projectId);

        return stats;
    }

    /**
     * Cleanup and maintenance
     */

    // Clean up old deployment logs (keep last 30 days)
    cleanupOldLogs() {
        const result = this.db.prepare(`
            DELETE FROM deployment_logs 
            WHERE timestamp < datetime('now', '-30 days')
        `).run();
        
        console.log(`🧹 Cleaned up ${result.changes} old log entries`);
        return result.changes;
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('🔒 Database connection closed');
        }
    }

    /**
     * Get database instance (for advanced queries)
     */
    getDatabase() {
        return this.db;
    }
}

// Export singleton instance
let dbInstance = null;

function getDatabase(dbPath = null) {
    if (!dbInstance) {
        dbInstance = new DatabaseManager(dbPath);
        dbInstance.init();
    }
    return dbInstance;
}

module.exports = {
    DatabaseManager,
    getDatabase
};