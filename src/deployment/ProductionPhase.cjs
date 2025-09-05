const { execSync } = require('child_process');
const HealthChecker = require('./HealthChecker.cjs');

/**
 * ProductionPhase - Handles production deployment
 */
class ProductionPhase {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.healthChecker = new HealthChecker(logger, config);
        this.rollbackData = null;
    }

    /**
     * Execute production deployment phase
     */
    async execute() {
        this.logger.logPhase('PHASE 4', 'Ejecutando deployment a producción...');
        
        try {
            // Create backup before deployment
            await this.createProductionBackup();
            
            // Deploy to production
            await this.deployToProduction();
            
            // Verify deployment
            await this.verifyProductionDeployment();
            
            this.logger.logSuccess('FASE 4 COMPLETADA: Production deployment exitoso');
            return { success: true, rollbackData: this.rollbackData };
            
        } catch (error) {
            this.logger.logError(`FASE 4 FALLIDA: ${error.message}`);
            
            // Attempt automatic rollback
            if (this.rollbackData) {
                await this.attemptRollback();
            }
            
            throw error;
        }
    }

    /**
     * Create production backup
     */
    async createProductionBackup() {
        this.logger.logProgress('Creando backup de producción...');
        
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup-${this.config.PROJECT_NAME}-${timestamp}`;
            
            // Store rollback information
            this.rollbackData = {
                timestamp,
                backupName,
                projectName: this.config.PROJECT_NAME,
                productionUrl: this.config.PRODUCTION_URL
            };
            
            // Try to create backup (if backup script exists)
            try {
                execSync(`npm run backup -- --name=${backupName}`, { stdio: 'pipe' });
                this.logger.logSuccess(`Backup creado: ${backupName}`);
            } catch (error) {
                this.logger.logWarning('Script de backup no encontrado, continuando sin backup...');
                this.rollbackData.hasBackup = false;
            }
            
        } catch (error) {
            this.logger.logError(`Error creando backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deploy to production
     */
    async deployToProduction() {
        this.logger.logProgress('Desplegando a producción...');
        
        try {
            // Run production deployment script
            execSync('npm run deploy:production', { 
                stdio: 'inherit',
                timeout: this.config.DEPLOYMENT_TIMEOUT || 300000 // 5 minutes
            });
            
            this.logger.logSuccess('Deployment a producción completado');
            
        } catch (error) {
            this.logger.logError(`Production deployment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify production deployment
     */
    async verifyProductionDeployment() {
        this.logger.logProgress('Verificando deployment de producción...');
        
        if (!this.config.PRODUCTION_URL) {
            this.logger.logWarning('PRODUCTION_URL no configurada, saltando verificación');
            return;
        }
        
        // Wait for production service to be ready
        await this.waitForService(this.config.PRODUCTION_URL);
        
        // Run production health checks
        await this.runProductionHealthChecks();
        
        this.logger.logSuccess('Verificación de producción completada');
    }

    /**
     * Wait for service to be ready
     */
    async waitForService(url, maxAttempts = 30, delay = 2000) {
        this.logger.logProgress(`Esperando que ${url} esté disponible...`);
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.healthChecker.checkEndpoint(url);
                if (result.healthy) {
                    this.logger.logSuccess(`Servicio disponible en ${url}`);
                    return true;
                }
            } catch (error) {
                this.logger.logProgress(`Intento ${attempt}/${maxAttempts} fallido, reintentando...`);
            }
            
            if (attempt < maxAttempts) {
                await this.sleep(delay);
            }
        }
        
        throw new Error(`Production service at ${url} not available after ${maxAttempts} attempts`);
    }

    /**
     * Run production health checks
     */
    async runProductionHealthChecks() {
        this.logger.logProgress('Ejecutando health checks de producción...');
        
        const endpoints = this.config.HEALTH_ENDPOINTS || ['/health'];
        const results = [];
        
        for (const endpoint of endpoints) {
            const fullUrl = this.config.PRODUCTION_URL + endpoint;
            const result = await this.healthChecker.checkEndpoint(fullUrl);
            results.push(result);
            
            if (!result.healthy) {
                throw new Error(`Production health check failed for ${fullUrl}`);
            }
        }
        
        this.logger.logSuccess(`Health checks completados: ${results.length} endpoints verificados`);
        return results;
    }

    /**
     * Attempt automatic rollback
     */
    async attemptRollback() {
        this.logger.logWarning('Iniciando rollback automático...');
        
        try {
            if (this.rollbackData && this.rollbackData.hasBackup !== false) {
                // Try to run rollback script
                execSync(`npm run rollback -- --backup=${this.rollbackData.backupName}`, { 
                    stdio: 'inherit',
                    timeout: 180000 // 3 minutes
                });
                
                this.logger.logSuccess('Rollback completado exitosamente');
            } else {
                this.logger.logWarning('No hay datos de rollback disponibles');
            }
            
        } catch (error) {
            this.logger.logError(`Rollback falló: ${error.message}`);
            this.logger.logError('INTERVENCIÓN MANUAL REQUERIDA');
        }
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ProductionPhase;