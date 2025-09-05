const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * ProjectConfig - Dynamic configuration system for CI/CD projects
 * 
 * Auto-detects project settings from:
 * 1. Git remote origin
 * 2. package.json
 * 3. cicd-config.json (if exists)
 * 4. Environment variables (highest priority)
 */
class ProjectConfig {
    constructor() {
        this.config = {};
    }

    /**
     * Load configuration from all sources with priority order
     */
    static async load() {
        const instance = new ProjectConfig();
        
        try {
            // Step 1: Auto-detect from git and package.json
            const autoDetected = await instance.autoDetect();
            
            // Step 2: Load from config file (if exists)
            const configFile = await instance.loadConfigFile();
            
            // Step 3: Load from environment variables (highest priority)
            const envVars = instance.loadEnvVars();
            
            // Step 4: Merge all sources (env vars override everything)
            const mergedConfig = {
                ...autoDetected,
                ...configFile,
                ...envVars
            };
            
            instance.config = instance.validateAndSetDefaults(mergedConfig);
            
            console.log('🔧 Configuration loaded successfully');
            console.log(`📁 Project: ${instance.config.projectName}`);
            console.log(`🌍 Production URL: ${instance.config.productionUrl}`);
            console.log(`📦 Repository: ${instance.config.githubRepo}`);
            
            return instance.config;
            
        } catch (error) {
            console.error('❌ Configuration load error:', error.message);
            throw error;
        }
    }

    /**
     * Auto-detect configuration from git and package.json
     */
    async autoDetect() {
        const detected = {};
        
        try {
            // Get git remote origin
            const gitRemote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
            const { owner, repo } = this.parseGitUrl(gitRemote);
            
            detected.githubRepo = `${owner}/${repo}`;
            detected.projectName = repo;
            
            console.log(`🔍 Auto-detected from git: ${detected.githubRepo}`);
            
        } catch (error) {
            console.warn('⚠️ Could not auto-detect git repository');
        }
        
        try {
            // Load package.json for additional info
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                if (packageJson.name && !detected.projectName) {
                    detected.projectName = packageJson.name;
                }
                
                // Extract potential URLs from package.json
                if (packageJson.homepage) {
                    detected.productionUrl = packageJson.homepage;
                }
                
                console.log(`📦 Auto-detected from package.json: ${packageJson.name}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not read package.json');
        }
        
        return detected;
    }

    /**
     * Load configuration from cicd-config.json file
     */
    async loadConfigFile() {
        const configPath = path.join(process.cwd(), 'cicd-config.json');
        
        if (!fs.existsSync(configPath)) {
            console.log('📄 No cicd-config.json found - using defaults');
            return {};
        }
        
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            console.log('📄 Loaded configuration from cicd-config.json');
            return config;
            
        } catch (error) {
            console.error(`❌ Error reading cicd-config.json: ${error.message}`);
            return {};
        }
    }

    /**
     * Load configuration from environment variables
     */
    loadEnvVars() {
        const envConfig = {};
        
        // Map environment variables to config keys
        const envMapping = {
            'PROJECT_NAME': 'projectName',
            'PRODUCTION_URL': 'productionUrl',
            'STAGING_URL': 'stagingUrl',
            'GITHUB_REPO': 'githubRepo',
            'WEBHOOK_PORT': 'port',
            'WEBHOOK_SECRET': 'webhookSecret',
            'MAIN_BRANCH': 'mainBranch',
            'NODE_ENV': 'environment',
        };
        
        for (const [envVar, configKey] of Object.entries(envMapping)) {
            if (process.env[envVar]) {
                envConfig[configKey] = process.env[envVar];
                console.log(`🌍 Environment variable loaded: ${envVar} -> ${configKey}`);
            }
        }
        
        return envConfig;
    }

    /**
     * Parse git URL to extract owner and repository name
     */
    parseGitUrl(gitUrl) {
        // Handle both HTTPS and SSH formats
        // HTTPS: https://github.com/owner/repo.git
        // SSH: git@github.com:owner/repo.git
        
        let match;
        
        // Try HTTPS format first
        match = gitUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
        
        // Try SSH format
        match = gitUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
        
        throw new Error(`Unable to parse git URL: ${gitUrl}`);
    }

    /**
     * Validate configuration and set defaults
     */
    validateAndSetDefaults(config) {
        const defaults = {
            port: 3000,
            mainBranch: 'master',
            environment: 'development',
            healthCheckInterval: 30000, // 30 seconds
            deploymentTimeout: 600000,  // 10 minutes
            webhookSecret: null,
        };

        const finalConfig = { ...defaults, ...config };

        // Validate required fields
        const required = ['projectName', 'githubRepo'];
        for (const field of required) {
            if (!finalConfig[field]) {
                throw new Error(`Required configuration field missing: ${field}`);
            }
        }

        // Set production URL if not provided
        if (!finalConfig.productionUrl) {
            console.warn('⚠️ PRODUCTION_URL not set - deployment may not work correctly');
            finalConfig.productionUrl = `https://${finalConfig.projectName}.example.com`;
        }

        return finalConfig;
    }

    /**
     * Create example configuration file
     */
    static createExampleConfig() {
        const exampleConfig = {
            "projectName": "my-project",
            "productionUrl": "https://my-project.example.com",
            "stagingUrl": "https://staging.my-project.example.com",
            "githubRepo": "username/my-project",
            "port": 3000,
            "mainBranch": "main",
            "webhookSecret": "your-webhook-secret-here",
            "environment": "production",
            "healthCheckInterval": 30000,
            "deploymentTimeout": 600000
        };

        const configPath = path.join(process.cwd(), 'cicd-config.example.json');
        fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
        
        console.log(`📝 Example configuration created at: ${configPath}`);
        console.log('💡 Copy this to cicd-config.json and customize for your project');
        
        return configPath;
    }

    /**
     * Get current configuration (for already loaded instance)
     */
    getConfig() {
        return this.config;
    }
}

module.exports = ProjectConfig;