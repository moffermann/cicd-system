#!/usr/bin/env node

const notifier = require('node-notifier');

console.log('🚨 PROBANDO SONIDOS MÁS URGENTES PARA ERROR');

const errorSounds = ['Sosumi', 'Glass', 'Funk', 'Blow'];

async function testErrorSounds() {
  for (let i = 0; i < errorSounds.length; i++) {
    const sound = errorSounds[i];
    console.log(`\n${i + 1}. Probando sonido: ${sound}`);
    
    notifier.notify({
      title: `🚨 ERROR ${i + 1} - ${sound}`,
      message: `Sonido de error: ${sound}`,
      sound: sound,
      timeout: 5
    });
    
    // Esperar 4 segundos entre cada sonido
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  
  console.log('\n🔍 ¿Cuál de estos sonidos te parece más apropiado para ERROR?');
  console.log('1. Sosumi');
  console.log('2. Glass'); 
  console.log('3. Funk');
  console.log('4. Blow');
}

testErrorSounds();