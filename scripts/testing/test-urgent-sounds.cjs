#!/usr/bin/env node

const notifier = require('node-notifier');

console.log('🚨 PROBANDO SONIDOS MÁS URGENTES Y DISTINTIVOS PARA ERROR');

// Sonidos más agresivos/urgentes
const urgentSounds = ['Submarine', 'Ping', 'Pop', 'Purr', 'Tink'];

async function testUrgentSounds() {
  for (let i = 0; i < urgentSounds.length; i++) {
    const sound = urgentSounds[i];
    console.log(`\n${i + 1}. Probando sonido URGENTE: ${sound}`);
    
    notifier.notify({
      title: `🚨 URGENT ERROR ${i + 1} - ${sound}`,
      message: `¡FALLO CRÍTICO! Sonido: ${sound}`,
      sound: sound,
      timeout: 8
    });
    
    // Esperar 5 segundos entre cada sonido
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n🔍 ¿Alguno de estos sonidos te parece más URGENTE/ERROR?');
  console.log('1. Submarine');
  console.log('2. Ping');
  console.log('3. Pop');
  console.log('4. Purr'); 
  console.log('5. Tink');
}

testUrgentSounds();