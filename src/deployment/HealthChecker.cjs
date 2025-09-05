const fetch = require('node-fetch');

/**
 * HealthChecker - Health check utilities for deployments
 */
class HealthChecker {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  async checkEndpoint(url, timeout = 10000) {
    try {
      this.logger.logProgress(`Verificando endpoint: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CICD-Health-Check/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      const isHealthy = response.ok && response.status === 200;
      
      if (isHealthy) {
        this.logger.logSuccess(`✅ ${url} respondió correctamente (${response.status})`);
      } else {
        this.logger.logError(`❌ ${url} respondió con error (${response.status})`);
      }
      
      return {
        url,
        status: response.status,
        healthy: isHealthy,
        responseTime: Date.now() - Date.now() // TODO: measure actual response time
      };
      
    } catch (error) {
      this.logger.logError(`❌ ${url} no accesible: ${error.message}`);
      return {
        url,
        status: 0,
        healthy: false,
        error: error.message
      };
    }
  }

  async performHealthChecks(baseUrl, endpoints = ['/health', '/api/health']) {
    this.logger.logProgress('Ejecutando verificaciones de salud...');
    
    const results = [];
    let healthyCount = 0;
    
    for (const endpoint of endpoints) {
      const fullUrl = `${baseUrl}${endpoint}`;
      const result = await this.checkEndpoint(fullUrl, this.config.HEALTH_CHECK_TIMEOUT);
      results.push(result);
      
      if (result.healthy) {
        healthyCount++;
      }
    }
    
    const allHealthy = healthyCount === endpoints.length;
    const healthPercentage = Math.round((healthyCount / endpoints.length) * 100);
    
    this.logger.logInfo(`Health checks: ${healthyCount}/${endpoints.length} (${healthPercentage}%) pasaron`);
    
    if (!allHealthy) {
      this.logger.logWarning('Algunos endpoints de salud fallaron');
    }
    
    return {
      healthy: allHealthy,
      healthyCount,
      totalCount: endpoints.length,
      healthPercentage,
      results
    };
  }

  async waitForHealthy(baseUrl, maxAttempts = 10, intervalMs = 3000) {
    this.logger.logProgress(`Esperando que ${baseUrl} esté saludable...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.logProgress(`Intento ${attempt}/${maxAttempts}...`);
      
      const healthCheck = await this.performHealthChecks(baseUrl);
      
      if (healthCheck.healthy) {
        this.logger.logSuccess(`${baseUrl} está saludable después de ${attempt} intentos`);
        return true;
      }
      
      if (attempt < maxAttempts) {
        this.logger.logInfo(`Esperando ${intervalMs/1000}s antes del próximo intento...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    this.logger.logError(`${baseUrl} no pudo ser alcanzado después de ${maxAttempts} intentos`);
    return false;
  }

  async continuousMonitoring(baseUrl, durationMs, intervalMs = 30000) {
    this.logger.logProgress(`Iniciando monitoreo continuo por ${durationMs/1000}s...`);
    
    const startTime = Date.now();
    const checks = [];
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    while (Date.now() - startTime < durationMs) {
      const healthCheck = await this.performHealthChecks(baseUrl);
      checks.push({
        timestamp: new Date().toISOString(),
        ...healthCheck
      });
      
      if (healthCheck.healthy) {
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        this.logger.logWarning(`Fallo de salud consecutivo #${consecutiveFailures}`);
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          this.logger.logError(`¡ALERTA! ${consecutiveFailures} fallos consecutivos detectados`);
          return {
            success: false,
            reason: `${consecutiveFailures} fallos consecutivos`,
            checks
          };
        }
      }
      
      // Wait for next check
      if (Date.now() - startTime < durationMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    const successfulChecks = checks.filter(c => c.healthy).length;
    const successRate = (successfulChecks / checks.length) * 100;
    
    this.logger.logSuccess(`Monitoreo completado: ${successfulChecks}/${checks.length} checks exitosos (${successRate.toFixed(1)}%)`);
    
    return {
      success: successRate >= 90, // 90% success rate required
      successRate,
      totalChecks: checks.length,
      successfulChecks,
      checks
    };
  }
}

module.exports = HealthChecker;