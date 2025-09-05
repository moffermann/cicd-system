const { execSync } = require('child_process');

/**
 * ValidationPhase - Pre-deployment validation checks
 */
class ValidationPhase {
  constructor(logger) {
    this.logger = logger;
    this.validations = [
      { name: 'Unit Tests', command: 'npm test', optional: true },
      { name: 'Linting', command: 'npm run lint', optional: true },
      { name: 'Type Check', command: 'npm run type-check', optional: true },
      { name: 'Security Scan', command: 'npm audit --audit-level moderate', optional: true }
    ];
  }

  async execute() {
    this.logger.logPhase('FASE 1', 'Ejecutando pre-validación local...');
    
    let passed = 0;
    let failed = 0;
    const errors = [];

    for (const validation of this.validations) {
      try {
        this.logger.logProgress(`Ejecutando ${validation.name}...`);
        execSync(validation.command, { stdio: 'pipe' });
        this.logger.logSuccess(`${validation.name} completado exitosamente`);
        passed++;
      } catch (error) {
        const errorMsg = `${validation.name} falló: ${error.message}`;
        
        if (validation.optional) {
          this.logger.logWarning(`${errorMsg} (opcional - continuando)`);
        } else {
          this.logger.logError(errorMsg);
          errors.push(errorMsg);
          failed++;
        }
      }
    }

    this.logger.logInfo(`Pre-validación completada: ${passed} exitosos, ${failed} fallidos`);

    if (failed > 0) {
      throw new Error(`Pre-validación falló: ${errors.join(', ')}`);
    }

    return { passed, failed, errors };
  }

  // Allow custom validations to be added
  addValidation(name, command, optional = true) {
    this.validations.push({ name, command, optional });
  }

  // Set which validations are required
  setRequired(validationNames) {
    this.validations.forEach(v => {
      v.optional = !validationNames.includes(v.name);
    });
  }
}

module.exports = ValidationPhase;