/**
 * RouteHandler - HTTP route handling for webhook server
 */
class RouteHandler {
    constructor(database, serverConfig) {
        this.db = database;
        this.config = serverConfig;
    }

    /**
     * Health check endpoint handler
     */
    async handleHealthCheck(req, res) {
        try {
            const projects = this.db.getAllProjects();
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                projects: projects.length,
                server_version: '2.0.0-multi-project',
                features: this.config.getValue('enabledFeatures', {}),
                uptime: process.uptime()
            };

            res.json(health);
        } catch (error) {
            console.error('❌ Health check failed:', error);
            res.status(500).json({
                status: 'error',
                message: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Projects API endpoint handler
     */
    async handleGetProjects(req, res) {
        try {
            const projects = this.db.getAllProjects();
            res.json({ success: true, projects });
        } catch (error) {
            console.error('❌ Failed to fetch projects:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch projects' 
            });
        }
    }

    /**
     * Get single project handler
     */
    async handleGetProject(req, res) {
        try {
            const { name } = req.params;
            const project = this.db.getProjectByName(name);
            
            if (!project) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Project not found' 
                });
            }

            res.json({ success: true, project });
        } catch (error) {
            console.error('❌ Failed to fetch project:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch project' 
            });
        }
    }

    /**
     * Deployments API endpoint handler
     */
    async handleGetDeployments(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const project = req.query.project;
            
            let deployments;
            if (project) {
                deployments = this.db.getProjectDeployments(project, limit, offset);
            } else {
                deployments = this.db.getRecentDeployments(limit, offset);
            }
            
            res.json({ 
                success: true, 
                deployments,
                pagination: { limit, offset }
            });
        } catch (error) {
            console.error('❌ Failed to fetch deployments:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch deployments' 
            });
        }
    }

    /**
     * CI notification legacy endpoint handler
     */
    async handleCiNotification(req, res) {
        console.log('\n🔔 ===== CI NOTIFICATION RECEIVED =====');
        console.log('📅 Timestamp:', new Date().toLocaleString());
        console.log('📦 Payload:', JSON.stringify(req.body, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Notification received',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Admin endpoints (if admin is enabled)
     */
    async handleAdminStatus(req, res) {
        if (!this.config.isFeatureEnabled('admin')) {
            return res.status(403).json({ message: 'Admin features disabled' });
        }

        // Verify admin token
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token !== this.config.getAdminToken()) {
            return res.status(401).json({ message: 'Invalid admin token' });
        }

        try {
            const stats = await this.getSystemStats();
            res.json({ success: true, stats });
        } catch (error) {
            console.error('❌ Failed to get admin status:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to get system status' 
            });
        }
    }

    /**
     * Get system statistics
     */
    async getSystemStats() {
        const projects = this.db.getAllProjects();
        const recentDeployments = this.db.getRecentDeployments(10);
        
        return {
            projects: {
                total: projects.length,
                active: projects.filter(p => p.active).length
            },
            deployments: {
                recent: recentDeployments.length,
                lastDeployment: recentDeployments[0] || null
            },
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '2.0.0-multi-project'
            }
        };
    }

    /**
     * Error handler middleware
     */
    handleError(error, req, res, next) {
        console.error('❌ Route error:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Not found handler
     */
    handleNotFound(req, res) {
        res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            path: req.path,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Request logging middleware
     */
    logRequest(req, res, next) {
        if (this.config.isFeatureEnabled('logging')) {
            console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
        }
        next();
    }
}

module.exports = RouteHandler;