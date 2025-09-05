#!/usr/bin/env node

/**
 * 🚀 REFACTORED PRODUCTION DEPLOYMENT SCRIPT
 * 
 * Este script implementa el protocolo formal de deployment
 * con validaciones estrictas y rollback automático.
 * 
 * USAGE: npm run deploy [--project=project-name]
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ProjectConfig = require('./config/ProjectConfig.cjs');
const ProductionDeployer = require('./deployment/ProductionDeployer.cjs');

// 🎯 CONFIGURACIÓN DE DEPLOYMENT BASE
const BASE_CONFIG = {
  HEALTH_CHECK_TIMEOUT: 30000,
  POST_DEPLOYMENT_MONITORING: 300000, // 5 minutos
  MAX_ERROR_RATE: 0.01, // 1%
  MAX_RESPONSE_TIME: 2000, // 2 segundos
  ROLLBACK_THRESHOLD: 5, // 5 errores consecutivos
  
  HEALTH_ENDPOINTS: [
    '/health',
    '/api/health', 
    '/admin/health'
  ]
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (const arg of args) {
    if (arg.startsWith('--project=')) {
      options.project = arg.split('=')[1];
    } else if (arg.startsWith('--env=')) {
      options.environment = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-staging') {
      options.skipStaging = true;
    }
  }
  
  return options;
}

/**
 * Main deployment function
 */
async function main() {
  let deployer;
  
  try {
    console.log('🚀 INICIANDO ENTERPRISE PRODUCTION DEPLOYMENT');
    console.log('='.repeat(60));
    
    // Parse command line options
    const options = parseArguments();
    
    // Load project configuration
    const projectConfig = await ProjectConfig.load(options.project);
    
    // Merge configurations
    const config = {
      ...BASE_CONFIG,
      ...projectConfig,
      STAGING_URL: projectConfig.stagingUrl || process.env.STAGING_URL || `https://staging-${projectConfig.projectName}.com`,
      PRODUCTION_URL: projectConfig.productionUrl || process.env.PRODUCTION_URL,
      PROJECT_NAME: projectConfig.projectName,
      GITHUB_REPO: projectConfig.githubRepo,
      DEPLOYMENT_TIMEOUT: projectConfig.deploymentTimeout || BASE_CONFIG.POST_DEPLOYMENT_MONITORING,
      DATABASE_URL: projectConfig.databaseUrl || process.env.DATABASE_URL
    };
    
    // Validate required configuration
    if (!config.PRODUCTION_URL) {
      throw new Error('PRODUCTION_URL is required but not configured');
    }
    
    if (!config.PROJECT_NAME) {
      throw new Error('PROJECT_NAME is required but not configured');
    }
    
    // Display configuration summary
    console.log(`📁 Proyecto: ${config.PROJECT_NAME}`);
    console.log(`🌐 Producción: ${config.PRODUCTION_URL}`);
    console.log(`🧪 Staging: ${config.STAGING_URL}`);
    console.log(`🏗️ Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('='.repeat(60));
    
    // Create and execute deployment
    deployer = new ProductionDeployer(config, {
      deploymentId: `deploy_${config.PROJECT_NAME}_${Date.now()}`,
      dryRun: options.dryRun,
      skipStaging: options.skipStaging
    });
    
    const result = await deployer.deploy();
    
    console.log('\n🎉 PRODUCTION DEPLOYMENT COMPLETADO EXITOSAMENTE');
    console.log(`⏱️ Duración total: ${Math.round((result.endTime - result.startTime) / 1000)}s`);
    console.log(`📊 Fases completadas: ${Object.keys(result.phases).length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 PRODUCTION DEPLOYMENT FAILED');
    console.error(`❌ Error: ${error.message}`);
    
    if (deployer) {
      console.log('\n📊 Estado del deployment:');
      const status = deployer.getStatus();
      console.log(`   Deployment ID: ${status.deploymentId}`);
      console.log(`   Fases completadas: ${Object.keys(status.results.phases).length}`);
      console.log(`   Errores: ${status.results.errors.length}`);
    }
    
    console.error('\n🔍 Para más detalles, revisa los logs anteriores');
    process.exit(1);
  }
}

// 🚦 MANEJO DE SEÑALES
process.on('SIGINT', () => {
  console.log('\n⚠️ Deployment interrumpido por usuario');
  console.log('🛑 Deteniendo deployment...');
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(`\n💥 Unhandled rejection: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`\n💥 Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

// 🎬 EJECUTAR
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ProductionDeployer, BASE_CONFIG };