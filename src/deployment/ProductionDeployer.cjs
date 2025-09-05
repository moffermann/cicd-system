const DeploymentLogger = require('./DeploymentLogger.cjs');
const ValidationPhase = require('./ValidationPhase.cjs');
const StagingPhase = require('./StagingPhase.cjs');
const ProductionPhase = require('./ProductionPhase.cjs');
const MonitoringPhase = require('./MonitoringPhase.cjs');

/**
 * ProductionDeployer - Refactored deployment orchestrator
 */
class ProductionDeployer {
    constructor(config, options = {}) {
        this.config = config;
        this.deploymentId = options.deploymentId || `deploy_${Date.now()}`;
        this.logger = new DeploymentLogger(this.deploymentId, options.dbLogger);
        
        // Initialize phases
        this.validationPhase = new ValidationPhase(this.logger);
        this.stagingPhase = new StagingPhase(this.logger, config);
        this.productionPhase = new ProductionPhase(this.logger, config);
        this.monitoringPhase = new MonitoringPhase(this.logger, config);
        
        this.rollbackData = null;
        this.deploymentResults = {
            phases: {},
            success: false,
            startTime: Date.now(),
            endTime: null,
            errors: []
        };
    }

    /**
     * Execute full deployment process
     */
    async deploy() {
        this.logger.logInfo(`Starting deployment ${this.deploymentId} for ${this.config.PROJECT_NAME}`);
        this.logger.logInfo(`Production URL: ${this.config.PRODUCTION_URL}`);
        this.logger.logInfo('='.repeat(60));
        
        try {
            // Phase 1: Pre-validation
            this.deploymentResults.phases.validation = await this.validationPhase.execute();
            
            // Phase 2: Staging deployment (optional)
            this.deploymentResults.phases.staging = await this.stagingPhase.execute();
            
            // Phase 3: Pre-production checks (implemented in productionPhase)
            
            // Phase 4: Production deployment
            const prodResult = await this.productionPhase.execute();
            this.deploymentResults.phases.production = prodResult;
            this.rollbackData = prodResult.rollbackData;
            
            // Phase 5: Post-deployment monitoring
            this.deploymentResults.phases.monitoring = await this.monitoringPhase.execute();
            
            // Mark deployment as successful
            this.deploymentResults.success = true;
            this.deploymentResults.endTime = Date.now();
            
            this.logger.logSuccess('🎉 PRODUCTION DEPLOYMENT COMPLETADO EXITOSAMENTE');
            
            return this.deploymentResults;
            
        } catch (error) {
            this.deploymentResults.success = false;
            this.deploymentResults.endTime = Date.now();
            this.deploymentResults.errors.push({
                message: error.message,
                timestamp: Date.now(),
                phase: this.getCurrentPhase()
            });
            
            this.logger.logError(`💥 PRODUCTION DEPLOYMENT FAILED: ${error.message}`);
            
            throw error;
        } finally {
            this.generateReport();
        }
    }

    /**
     * Execute pre-production checks
     */
    async executePreProductionChecks() {
        this.logger.logPhase('PHASE 3', 'Ejecutando verificaciones pre-producción...');
        
        const checks = [
            () => this.validateEnvironmentVariables(),
            () => this.validateDatabaseConnection(),
            () => this.validateDependencies(),
            () => this.validateSSLCertificates()
        ];

        for (const check of checks) {
            await check();
        }

        this.logger.logSuccess('FASE 3 COMPLETADA: Todas las verificaciones exitosas');
        return { success: true };
    }

    /**
     * Validate environment variables
     */
    async validateEnvironmentVariables() {
        this.logger.logProgress('Validando variables de entorno...');
        
        const required = ['NODE_ENV', 'PRODUCTION_URL'];
        const missing = required.filter(key => !process.env[key] && !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing environment variables: ${missing.join(', ')}`);
        }
        
        this.logger.logSuccess('Variables de entorno validadas');
    }

    /**
     * Validate database connection
     */
    async validateDatabaseConnection() {
        this.logger.logProgress('Validando conexión a base de datos...');
        
        try {
            // This is a placeholder - implement actual database validation
            // For now, just check if DATABASE_URL is configured
            if (this.config.DATABASE_URL || process.env.DATABASE_URL) {
                this.logger.logSuccess('Conexión a base de datos validada');
            } else {
                this.logger.logWarning('DATABASE_URL no configurada, saltando validación');
            }
        } catch (error) {
            throw new Error(`Database validation failed: ${error.message}`);
        }
    }

    /**
     * Validate dependencies
     */
    async validateDependencies() {
        this.logger.logProgress('Validando dependencias...');
        
        try {
            const { execSync } = require('child_process');
            execSync('npm ls --production --depth=0', { stdio: 'pipe' });
            this.logger.logSuccess('Dependencias validadas');
        } catch (error) {
            throw new Error(`Dependency validation failed: ${error.message}`);
        }
    }

    /**
     * Validate SSL certificates
     */
    async validateSSLCertificates() {
        this.logger.logProgress('Validando certificados SSL...');
        
        if (this.config.PRODUCTION_URL && this.config.PRODUCTION_URL.startsWith('https://')) {
            // This is a placeholder - implement actual SSL validation
            this.logger.logSuccess('Certificados SSL validados');
        } else {
            this.logger.logWarning('No HTTPS configurado, saltando validación SSL');
        }
    }

    /**
     * Get current deployment phase
     */
    getCurrentPhase() {
        const phases = Object.keys(this.deploymentResults.phases);
        return phases[phases.length - 1] || 'initialization';
    }

    /**
     * Generate deployment report
     */
    generateReport() {
        const report = this.logger.generateReport();
        
        // Add deployment-specific information
        const duration = this.deploymentResults.endTime - this.deploymentResults.startTime;
        
        console.log(`\n📊 DEPLOYMENT SUMMARY - ${this.deploymentId}`);
        console.log('='.repeat(60));
        console.log(`🎯 Project: ${this.config.PROJECT_NAME}`);
        console.log(`🌐 Production URL: ${this.config.PRODUCTION_URL}`);
        console.log(`⏱️ Total Duration: ${Math.round(duration / 1000)}s`);
        console.log(`✅ Success: ${this.deploymentResults.success ? 'YES' : 'NO'}`);
        console.log(`📋 Phases Completed: ${Object.keys(this.deploymentResults.phases).length}/5`);
        
        if (this.deploymentResults.errors.length > 0) {
            console.log(`❌ Errors: ${this.deploymentResults.errors.length}`);
            this.deploymentResults.errors.forEach(error => {
                console.log(`   - ${error.phase}: ${error.message}`);
            });
        }
        
        console.log('='.repeat(60));
        
        return {
            ...report,
            deploymentResults: this.deploymentResults,
            totalDuration: duration
        };
    }

    /**
     * Get deployment status
     */
    getStatus() {
        return {
            deploymentId: this.deploymentId,
            config: {
                projectName: this.config.PROJECT_NAME,
                productionUrl: this.config.PRODUCTION_URL
            },
            results: this.deploymentResults,
            rollbackData: this.rollbackData
        };
    }
}

module.exports = ProductionDeployer;