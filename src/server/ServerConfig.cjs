const fs = require('fs').promises;
const path = require('path');

/**
 * ServerConfig - Configuration management for webhook server
 */
class ServerConfig {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(process.cwd(), 'webhook-config.json');
        this.config = {
            adminToken: null,
            port: process.env.WEBHOOK_PORT || 8765,
            enabledFeatures: {
                admin: false,
                monitoring: true,
                logging: true
            }
        };
    }

    /**
     * Load configuration from file
     */
    async load() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const parsedConfig = JSON.parse(configData);
            
            this.config = {
                ...this.config,
                ...parsedConfig,
                enabledFeatures: {
                    ...this.config.enabledFeatures,
                    ...(parsedConfig.enabledFeatures || {})
                }
            };
            
            this.config.enabledFeatures.admin = !!this.config.adminToken;
            
            console.log('✅ Webhook configuration loaded');
            return this.config;
        } catch (error) {
            console.log('⚠️ No webhook-config.json found, using defaults');
            return this.config;
        }
    }

    /**
     * Get current configuration
     */
    get() {
        return { ...this.config };
    }

    /**
     * Get specific config value
     */
    getValue(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.config.enabledFeatures[feature] === true;
    }

    /**
     * Get port number
     */
    getPort() {
        return parseInt(this.config.port) || 8765;
    }

    /**
     * Get admin token
     */
    getAdminToken() {
        return this.config.adminToken;
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        if (isNaN(this.getPort()) || this.getPort() < 1 || this.getPort() > 65535) {
            errors.push('Invalid port number');
        }
        
        if (this.isFeatureEnabled('admin') && !this.getAdminToken()) {
            errors.push('Admin feature enabled but no admin token provided');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Create example configuration file
     */
    static async createExample(filePath) {
        const exampleConfig = {
            adminToken: 'your-secure-admin-token-here',
            port: 8765,
            enabledFeatures: {
                admin: true,
                monitoring: true,
                logging: true
            },
            rateLimit: {
                windowMs: 900000,
                maxRequests: 100
            },
            cors: {
                enabled: true,
                origins: ['http://localhost:3000']
            }
        };
        
        await fs.writeFile(filePath, JSON.stringify(exampleConfig, null, 2));
        return filePath;
    }
}

module.exports = ServerConfig;