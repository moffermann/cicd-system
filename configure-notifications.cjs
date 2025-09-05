#!/usr/bin/env node
/**
 * Configurador de notificaciones para el sistema CI/CD
 * Te ayuda a configurar diferentes tipos de notificaciones
 */

const fs = require('fs');
const path = require('path');

console.log('🔔 CONFIGURADOR DE NOTIFICACIONES CI/CD\n');
console.log('=' .repeat(60));

console.log('\n📋 OPCIONES DE NOTIFICACIÓN DISPONIBLES:\n');

console.log('1. 📱 NOTIFICACIONES DE WINDOWS');
console.log('   Estado: ✅ HABILITADAS por defecto');
console.log('   Aparecen en: Área de notificaciones de Windows');
console.log('   Para deshabilitar: set ENABLE_WINDOWS_NOTIFICATIONS=false');

console.log('\n2. 💬 NOTIFICACIONES DE CONSOLA');
console.log('   Estado: ✅ HABILITADAS por defecto');
console.log('   Aparecen en: Terminal/Consola donde se ejecuta el sistema');

console.log('\n3. 🌐 NOTIFICACIONES WEBHOOK (Email, Slack, Discord, etc.)');
console.log('   Estado: ⚠️ NO CONFIGURADAS');
console.log('   Para configurar: Necesitas una URL webhook');

console.log('\n' + '='.repeat(60));
console.log('🛠️ CONFIGURACIÓN SUGERIDA PARA WEBHOOKS:\n');

// Ejemplos de configuración
const webhookExamples = {
    slack: {
        name: 'Slack',
        url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
        description: 'Notificaciones en canal de Slack'
    },
    discord: {
        name: 'Discord',
        url: 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz',
        description: 'Notificaciones en servidor Discord'
    },
    teams: {
        name: 'Microsoft Teams',
        url: 'https://outlook.office.com/webhook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx@xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/IncomingWebhook/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'Notificaciones en canal Teams'
    },
    email: {
        name: 'Email (vía Zapier/Make/IFTTT)',
        url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
        description: 'Emails automáticos vía servicio de automatización'
    }
};

Object.entries(webhookExamples).forEach(([key, config]) => {
    console.log(`📌 ${config.name}:`);
    console.log(`   Ejemplo URL: ${config.url}`);
    console.log(`   Descripción: ${config.description}`);
    console.log('');
});

console.log('=' .repeat(60));
console.log('⚙️ PARA CONFIGURAR UN WEBHOOK:\n');

console.log('1. Crea un webhook en tu servicio preferido (Slack, Discord, etc.)');
console.log('2. Configura la variable de entorno:');
console.log('   export NOTIFICATION_WEBHOOK_URL="tu_url_webhook_aquí"');
console.log('');
console.log('3. O crea un archivo .env con:');
console.log('   NOTIFICATION_WEBHOOK_URL=tu_url_webhook_aquí');

console.log('\n🧪 PARA PROBAR LAS NOTIFICACIONES:');
console.log('   node test-notifications.cjs');

console.log('\n✅ Las notificaciones de Windows y consola YA están funcionando!');
console.log('✅ Solo necesitas configurar webhooks si quieres notificaciones externas.');

// Crear archivo de ejemplo .env si no existe
const envPath = path.join(process.cwd(), '.env.example');
if (!fs.existsSync(envPath)) {
    const envContent = `# Configuración de notificaciones CI/CD

# Habilitar/deshabilitar notificaciones Windows (true/false)
ENABLE_WINDOWS_NOTIFICATIONS=true

# URL del webhook para notificaciones externas (Slack, Discord, etc.)
# NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# URL de producción para el sistema
PRODUCTION_URL=https://cicd-system.example.com
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n📄 Creado archivo .env.example con configuraciones de ejemplo');
}

console.log('\n🚀 ¡Tu sistema de notificaciones está listo para usar!');