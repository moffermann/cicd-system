const fs = require('fs/promises');

class EnvironmentChecker {
    constructor(logger) {
        this.logger = logger;
    }

    async checkEnvironment() {
        const score = { current: 0, max: 3 };
        const details = {};
        
        const nodeVersion = process.version;
        details.nodeVersion = nodeVersion;
        if (nodeVersion >= 'v18.0.0') {
            score.current += 1;
        } else {
            this.logger.addIssue(`Versión de Node.js muy antigua: ${nodeVersion}`);
        }
        
        const requiredVars = ['PRODUCTION_URL'];
        let envVarsOk = 0;
        
        requiredVars.forEach(varName => {
            if (process.env[varName]) {
                envVarsOk++;
            } else {
                this.logger.addIssue(`Variable de entorno faltante: ${varName}`);
            }
        });
        
        details.environmentVariables = `${envVarsOk}/${requiredVars.length} configuradas`;
        if (envVarsOk === requiredVars.length) {
            score.current += 1;
        }
        
        try {
            await fs.access('webhook-config.json');
            details.webhookConfig = 'Configurado';
            score.current += 1;
        } catch (error) {
            details.webhookConfig = 'Faltante';
            this.logger.addIssue('Archivo webhook-config.json no encontrado');
        }
        
        return { score, details };
    }
}

module.exports = EnvironmentChecker;