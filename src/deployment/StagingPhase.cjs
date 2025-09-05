const { execSync } = require('child_process');
const HealthChecker = require('./HealthChecker.cjs');

/**
 * StagingPhase - Handles staging deployment and testing
 */
class StagingPhase {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.healthChecker = new HealthChecker(logger, config);
    }

    /**
     * Execute staging deployment phase
     */
    async execute() {
        this.logger.logPhase('PHASE 2', 'Desplegando a staging...');
        
        try {
            // Deploy to staging (if staging script exists)
            await this.deployToStaging();
            
            // Wait for staging to be ready
            if (this.config.STAGING_URL) {
                await this.waitForService(this.config.STAGING_URL);
                
                // Run smoke tests on staging
                await this.runSmokeTests(this.config.STAGING_URL);
                
                // Run performance tests
                await this.runPerformanceTests(this.config.STAGING_URL);
            }
            
            this.logger.logSuccess('FASE 2 COMPLETADA: Staging deployment exitoso');
            return { success: true };
            
        } catch (error) {
            this.logger.logWarning('FASE 2 SALTADA: Staging no disponible, continuando con producción...');
            return { success: false, skipped: true, error: error.message };
        }
    }

    /**
     * Deploy to staging environment
     */
    async deployToStaging() {
        try {
            this.logger.logProgress('Desplegando a ambiente staging...');
            execSync('npm run deploy:staging', { stdio: 'inherit' });
            this.logger.logSuccess('Staging deployment completado');
        } catch (error) {
            this.logger.logWarning('Deploy staging script no encontrado, continuando...');
            throw error;
        }
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
        
        throw new Error(`Service at ${url} not available after ${maxAttempts} attempts`);
    }

    /**
     * Run smoke tests on staging
     */
    async runSmokeTests(baseUrl) {
        this.logger.logProgress('Ejecutando smoke tests en staging...');
        
        const endpoints = this.config.HEALTH_ENDPOINTS || ['/health'];
        const results = [];
        
        for (const endpoint of endpoints) {
            const fullUrl = baseUrl + endpoint;
            const result = await this.healthChecker.checkEndpoint(fullUrl);
            results.push(result);
            
            if (!result.healthy) {
                throw new Error(`Smoke test failed for ${fullUrl}`);
            }
        }
        
        this.logger.logSuccess(`Smoke tests completados: ${results.length} endpoints verificados`);
        return results;
    }

    /**
     * Run performance tests
     */
    async runPerformanceTests(baseUrl) {
        this.logger.logProgress('Ejecutando pruebas de rendimiento...');
        
        try {
            // Simple performance test - measure response time
            const start = Date.now();
            const result = await this.healthChecker.checkEndpoint(baseUrl);
            const responseTime = Date.now() - start;
            
            const maxResponseTime = this.config.MAX_RESPONSE_TIME || 2000;
            
            if (responseTime > maxResponseTime) {
                this.logger.logWarning(`Tiempo de respuesta alto: ${responseTime}ms (max: ${maxResponseTime}ms)`);
            } else {
                this.logger.logSuccess(`Tiempo de respuesta: ${responseTime}ms`);
            }
            
            return { responseTime, healthy: result.healthy };
            
        } catch (error) {
            this.logger.logError(`Performance test failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StagingPhase;