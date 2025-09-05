const HealthChecker = require('./HealthChecker.cjs');

/**
 * MonitoringPhase - Handles post-deployment monitoring
 */
class MonitoringPhase {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.healthChecker = new HealthChecker(logger, config);
        this.errors = [];
        this.healthChecksPassed = 0;
    }

    /**
     * Execute post-deployment monitoring phase
     */
    async execute() {
        this.logger.logPhase('PHASE 5', 'Iniciando monitoreo post-deployment...');
        
        const monitoringDuration = this.config.POST_DEPLOYMENT_MONITORING || 300000; // 5 minutes
        const checkInterval = 30000; // 30 seconds
        const maxErrors = this.config.ROLLBACK_THRESHOLD || 5;
        
        this.logger.logInfo(`Monitoreando por ${Math.round(monitoringDuration / 1000)}s con checks cada ${Math.round(checkInterval / 1000)}s`);
        
        const startTime = Date.now();
        let lastCheckTime = 0;
        
        try {
            while ((Date.now() - startTime) < monitoringDuration) {
                const now = Date.now();
                
                if ((now - lastCheckTime) >= checkInterval) {
                    await this.performHealthCheck();
                    lastCheckTime = now;
                    
                    // Check if we've exceeded error threshold
                    if (this.errors.length >= maxErrors) {
                        throw new Error(`Too many errors detected (${this.errors.length}/${maxErrors})`);
                    }
                }
                
                // Sleep for a short time to avoid busy waiting
                await this.sleep(1000);
            }
            
            const successRate = this.healthChecksPassed / (this.healthChecksPassed + this.errors.length) * 100;
            
            this.logger.logSuccess(`FASE 5 COMPLETADA: Monitoreo exitoso (${successRate.toFixed(1)}% success rate)`);
            this.logger.logInfo(`Health checks passed: ${this.healthChecksPassed}, Errors: ${this.errors.length}`);
            
            return {
                success: true,
                healthChecksPassed: this.healthChecksPassed,
                errorsCount: this.errors.length,
                successRate,
                monitoringDuration
            };
            
        } catch (error) {
            this.logger.logError(`FASE 5 FALLIDA: ${error.message}`);
            throw error;
        }
    }

    /**
     * Perform health check
     */
    async performHealthCheck() {
        if (!this.config.PRODUCTION_URL) {
            this.logger.logWarning('PRODUCTION_URL no configurada, saltando health check');
            return;
        }
        
        try {
            const result = await this.healthChecker.checkEndpoint(this.config.PRODUCTION_URL);
            
            if (result.healthy) {
                this.healthChecksPassed++;
                this.logger.logProgress(`Health check OK (${this.healthChecksPassed} passed)`);
            } else {
                const error = `Health check failed: ${result.status}`;
                this.errors.push({ 
                    timestamp: Date.now(), 
                    error, 
                    url: this.config.PRODUCTION_URL 
                });
                this.logger.logWarning(`Health check failed (${this.errors.length} errors total)`);
            }
            
            // Check response time
            if (result.responseTime && result.responseTime > (this.config.MAX_RESPONSE_TIME || 2000)) {
                this.logger.logWarning(`Slow response time: ${result.responseTime}ms`);
            }
            
        } catch (error) {
            const errorMsg = `Health check error: ${error.message}`;
            this.errors.push({ 
                timestamp: Date.now(), 
                error: errorMsg, 
                url: this.config.PRODUCTION_URL 
            });
            this.logger.logError(errorMsg);
        }
    }

    /**
     * Check error rate
     */
    checkErrorRate() {
        const totalChecks = this.healthChecksPassed + this.errors.length;
        if (totalChecks === 0) return 0;
        
        const errorRate = this.errors.length / totalChecks;
        const maxErrorRate = this.config.MAX_ERROR_RATE || 0.01; // 1%
        
        if (errorRate > maxErrorRate) {
            this.logger.logError(`Error rate too high: ${(errorRate * 100).toFixed(2)}% (max: ${(maxErrorRate * 100).toFixed(2)}%)`);
            return false;
        }
        
        return true;
    }

    /**
     * Get monitoring stats
     */
    getStats() {
        const totalChecks = this.healthChecksPassed + this.errors.length;
        const successRate = totalChecks > 0 ? (this.healthChecksPassed / totalChecks) * 100 : 0;
        const errorRate = totalChecks > 0 ? (this.errors.length / totalChecks) * 100 : 0;
        
        return {
            totalChecks,
            healthChecksPassed: this.healthChecksPassed,
            errorsCount: this.errors.length,
            successRate: parseFloat(successRate.toFixed(2)),
            errorRate: parseFloat(errorRate.toFixed(2)),
            errors: [...this.errors]
        };
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MonitoringPhase;