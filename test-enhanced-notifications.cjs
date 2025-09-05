#!/usr/bin/env node
/**
 * Test de notificaciones mejoradas con:
 * - Prioridad alta para Windows (modo concentración)
 * - Sonidos diferenciados (Hero/Basso)
 * - WhatsApp con templates y fallback
 */

const NotificationManager = require('./src/notifications/NotificationManager.cjs');

async function testEnhancedNotifications() {
    console.log('🔔 PRUEBA DE NOTIFICACIONES MEJORADAS\n');
    console.log('=' .repeat(70));
    
    const notificationManager = new NotificationManager();
    
    console.log('📋 Configuración del sistema:');
    console.log(`   Windows: ${notificationManager.notifications.windows} (⚡ PRIORIDAD ALTA)`);
    console.log(`   Console: ${notificationManager.notifications.console}`);
    console.log(`   Webhook: ${notificationManager.notifications.webhook || '❌ No configurado'}`);
    console.log(`   WhatsApp: ${notificationManager.notifications.whatsapp.enabled ? '✅ Configurado' : '❌ No configurado'}`);
    
    if (notificationManager.notifications.whatsapp.enabled) {
        console.log(`   WhatsApp Phone: ${notificationManager.notifications.whatsapp.phoneNumber}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🧪 PROBANDO NOTIFICACIONES CON CARACTERÍSTICAS MEJORADAS:\n');
    
    const deployment = {
        project: 'cicd-system',
        commit: 'bcf2df9', 
        branch: 'master',
        timestamp: new Date().toISOString()
    };
    
    try {
        // 1. Test notificación SUCCESS con sonido Hero
        console.log('🎵 1. Probando notificación SUCCESS (Sonido: Hero, Prioridad: Alta)');
        console.log('   💡 Esta notificación debería superar el modo concentración');
        await notificationManager.deploymentSuccess({
            ...deployment,
            duration: '2m 30s'
        });
        console.log('   ✅ Enviada - ¿Llegó la notificación de Windows?');
        await sleep(3000);
        
        // 2. Test notificación ERROR con sonido Basso
        console.log('\n🔊 2. Probando notificación ERROR (Sonido: Basso, Prioridad: Alta)');
        console.log('   ⚠️ Esta debería ser más llamativa y superar modo concentración');
        await notificationManager.deploymentFailed({
            ...deployment,
            error: 'Test error - deployment falló en staging'
        });
        console.log('   ✅ Enviada - ¿Se escuchó el sonido Basso y llegó la notificación?');
        await sleep(3000);
        
        // 3. Test notificación WARNING
        console.log('\n⚠️ 3. Probando notificación WARNING (Sonido: Hero, Prioridad: Alta)');
        await notificationManager.deploymentWarning({
            ...deployment,
            warning: 'Tests parciales completados'
        });
        console.log('   ✅ Enviada - ¿Notificación visible en modo concentración?');
        await sleep(2000);
        
        // 4. Test WhatsApp (si está configurado)
        if (notificationManager.notifications.whatsapp.enabled) {
            console.log('\n📱 4. Probando WhatsApp con template...');
            await notificationManager.deploymentStarted(deployment);
            console.log('   ✅ Enviado - ¿Llegó el mensaje WhatsApp?');
        } else {
            console.log('\n📱 4. WhatsApp NO configurado');
            console.log('   💡 Para habilitar, configura estas variables:');
            console.log('   export WHATSAPP_ACCESS_TOKEN="tu_token"');
            console.log('   export WHATSAPP_PHONE_NUMBER="5491112345678"');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ PRUEBA COMPLETADA\n');
        
        console.log('📊 RESUMEN DE CARACTERÍSTICAS PROBADAS:');
        console.log('   🔊 Sonidos diferenciados:');
        console.log('     - SUCCESS/WARNING/INFO: Hero (agradable)');
        console.log('     - ERROR: Basso (más llamativo)');
        console.log('   ⚡ Prioridad alta: Windows notifications con urgency=critical');
        console.log('   🎯 Modo concentración: Debería superar la configuración normal');
        
        if (notificationManager.notifications.whatsapp.enabled) {
            console.log('   📱 WhatsApp: Templates con fallback a texto plano');
        } else {
            console.log('   📱 WhatsApp: No configurado (opcional)');
        }
        
        console.log('\n🔍 VERIFICAR:');
        console.log('   1. ¿Llegaron las notificaciones de Windows INCLUSO en modo concentración?');
        console.log('   2. ¿Se escucharon los sonidos Hero y Basso correctamente?');
        console.log('   3. ¿Las notificaciones aparecieron con prioridad alta?');
        if (notificationManager.notifications.whatsapp.enabled) {
            console.log('   4. ¿Llegó el mensaje WhatsApp?');
        }
        
    } catch (error) {
        console.error('❌ Error durante la prueba:', error);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar si se llama directamente
if (require.main === module) {
    testEnhancedNotifications().then(() => {
        console.log('\n🚀 Prueba de notificaciones mejoradas completada!');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Error:', error);
        process.exit(1);
    });
}

module.exports = testEnhancedNotifications;