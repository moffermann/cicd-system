#!/usr/bin/env node
/**
 * Test completo del sistema de notificaciones
 * Prueba todos los tipos de notificaciones disponibles
 */

const NotificationManager = require('./src/notifications/NotificationManager.cjs');

async function testCompleteNotificationSystem() {
    console.log('🚀 INICIANDO PRUEBA COMPLETA DEL SISTEMA DE NOTIFICACIONES\n');
    console.log('=' .repeat(70));
    
    // Crear el gestor de notificaciones
    const notificationManager = new NotificationManager();
    
    console.log('📋 Configuración del sistema:');
    console.log(`   Windows notifications: ${notificationManager.notifications.windows}`);
    console.log(`   Console notifications: ${notificationManager.notifications.console}`);
    console.log(`   Webhook URL: ${notificationManager.notifications.webhook || 'No configurado'}`);
    console.log('');
    
    try {
        // Ejecutar el test completo del sistema
        console.log('🧪 Ejecutando test automático del sistema de notificaciones...\n');
        await notificationManager.testNotifications();
        
        console.log('\n' + '='.repeat(70));
        console.log('🎯 PRUEBA MANUAL ADICIONAL - Enviando notificaciones específicas...\n');
        
        // Prueba manual adicional con datos realistas
        const deploymentData = {
            project: 'cicd-system',
            commit: 'bcf2df9',
            branch: 'master',
            timestamp: new Date().toISOString(),
            duration: '45s'
        };
        
        // 1. Notificación de inicio de deployment
        console.log('📤 1. Enviando notificación de inicio de deployment...');
        await notificationManager.deploymentStarted(deploymentData);
        await sleep(2000);
        
        // 2. Notificación de éxito
        console.log('📤 2. Enviando notificación de deployment exitoso...');
        await notificationManager.deploymentSuccess({
            ...deploymentData,
            duration: '1m 23s'
        });
        await sleep(2000);
        
        // 3. Notificación de warning
        console.log('📤 3. Enviando notificación de warning...');
        await notificationManager.deploymentWarning({
            ...deploymentData,
            warning: 'Tests parciales - algunos tests no ejecutados debido a timeout'
        });
        await sleep(2000);
        
        // 4. Notificación de error (simulada)
        console.log('📤 4. Enviando notificación de error (simulada)...');
        await notificationManager.deploymentFailed({
            ...deploymentData,
            error: 'Build falló: TypeScript compilation error en src/deployment/ProductionPhase.cjs:42'
        });
        await sleep(1000);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ PRUEBA COMPLETA DEL SISTEMA DE NOTIFICACIONES FINALIZADA');
        console.log('');
        console.log('📊 Resumen:');
        console.log('   ✅ Notificaciones de consola: Funcionando');
        if (process.platform === 'win32' && notificationManager.notifications.windows) {
            console.log('   ✅ Notificaciones de Windows: Enviadas (revisa el área de notificaciones)');
        } else {
            console.log('   ⚠️  Notificaciones de Windows: Deshabilitadas o no disponibles en esta plataforma');
        }
        if (notificationManager.notifications.webhook) {
            console.log('   ✅ Notificaciones webhook: Enviadas (revisa logs de webhook)');
        } else {
            console.log('   ⚠️  Notificaciones webhook: No configuradas');
        }
        
        console.log('\n🎉 ¡Sistema de notificaciones funcionando correctamente!');
        
    } catch (error) {
        console.error('❌ Error durante la prueba de notificaciones:', error);
        process.exit(1);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar si se llama directamente
if (require.main === module) {
    testCompleteNotificationSystem().then(() => {
        console.log('\n✅ Prueba completada exitosamente');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
}

module.exports = testCompleteNotificationSystem;