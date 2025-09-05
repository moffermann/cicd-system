# 🔔 Auto Webhook Server Setup

Sistema automatizado para recibir notificaciones de CI/CD desde el servidor de producción directamente en tu máquina local.

## ✅ **Requisitos Previos**

1. **Node.js** instalado
2. **ngrok** instalado ([Descargar aquí](https://ngrok.com/download))
3. **Cuenta ngrok** (gratis) para obtener authtoken
4. **Token JWT** de admin del sistema

## 🚀 **Instalación (Solo una vez)**

### 1. Configurar ngrok
```bash
# Registrarte en ngrok.com y obtener tu authtoken
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

### 2. Configurar token de admin
Crear archivo `webhook-config.json` en la raíz del proyecto:
```json
{
  "adminToken": "tu-token-jwt-aqui"
}
```

**¿Cómo obtener el token JWT?**
1. Ir a https://tdbot.gocode.cl/admin/login
2. Login con admin/admin123
3. Abrir DevTools (F12) → Network
4. Hacer cualquier request → Ver el header Authorization
5. Copiar el token (sin "Bearer ")

## 🎯 **Uso Diario**

### Opción A: Script Automático (Recomendado)
```bash
# Ejecutar script que maneja todo automáticamente
node scripts/webhook-server.js
```

**¿Qué hace el script automático?**
- ✅ Inicia servidor HTTP local en puerto 8765
- ✅ Inicia ngrok automáticamente y obtiene URL pública
- ✅ Configura el webhook en producción con la nueva URL
- ✅ Queda escuchando notificaciones de CI/CD
- ✅ Muestra notificaciones formateadas en tiempo real

### Opción B: Manual (Para troubleshooting)

**Terminal 1:**
```bash
# Iniciar ngrok
ngrok http 8765
# Copiar la URL https://abc123.ngrok-free.app
```

**Terminal 2:**
```bash
# Iniciar servidor webhook
node scripts/webhook-server.js
```

**Terminal 3:**
```bash
# Configurar webhook en producción
curl -X POST https://tdbot.gocode.cl/api/ci/configure-webhook \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://abc123.ngrok-free.app/ci-notification"}'
```

## 📱 **Tipos de Notificaciones**

El sistema recibirá notificaciones de:

### 1. **Pipeline CI/CD**
```json
{
  "phase": "pipeline",
  "status": "complete",
  "summary": "All tests passed successfully",
  "duration": 45230,
  "deploymentId": "deploy_1642234567890"
}
```

### 2. **Deployment Status**
```json
{
  "phase": "deployment",
  "status": "success",
  "summary": "Production deployment completed",
  "duration": 120000,
  "deploymentId": "deploy_1642234567890"
}
```

### 3. **Health Check Alerts**
```json
{
  "phase": "health-check",
  "status": "failure",
  "error": "Database connection timeout",
  "deploymentId": "deploy_1642234567890"
}
```

## 🖥️ **Output Esperado**

```bash
🚀 Iniciando Auto Webhook Server...
✅ Configuración cargada
✅ Servidor HTTP iniciado en puerto 8765
🚀 Iniciando ngrok...
✅ Ngrok tunnel activo: https://abc123.ngrok-free.app
🔧 Configurando webhook en producción: https://abc123.ngrok-free.app
✅ Webhook configurado en producción exitosamente

🎉 ===== AUTO WEBHOOK SERVER LISTO =====
🌐 URL Local: http://localhost:8765
🔗 URL Pública: https://abc123.ngrok-free.app
🎯 Endpoint CI: https://abc123.ngrok-free.app/ci-notification
📡 Webhook configurado en producción ✅
=====================================

💡 Tip: Haz git push para probar el pipeline completo
🔔 Las notificaciones aparecerán aquí automáticamente
```

## 🔔 **Ejemplo de Notificación Recibida**

```bash
🔔 ===== NOTIFICACIÓN DE CI RECIBIDA =====
📅 Timestamp: 15/1/2025, 10:30:25
📦 Payload: {
  "phase": "pipeline",
  "status": "complete",
  "duration": 45230,
  "deploymentId": "deploy_1642234567890",
  "summary": "All tests passed successfully"
}

✅ FASE: pipeline
📊 Estado: COMPLETE
⏱️ Duración: 45230ms
🆔 Deployment: deploy_1642234567890
📋 Resumen: All tests passed successfully

🎯 ===== PIPELINE CI COMPLETADO =====
🎉 ¡Todos los tests pasaron exitosamente!
=====================================
```

## 🛠️ **Troubleshooting**

### Problema: "No se encontró configuración"
```bash
# Crear archivo de configuración
echo '{"adminToken": "tu-token-jwt"}' > webhook-config.json
```

### Problema: "ngrok no pudo iniciarse"
```bash
# Verificar instalación
ngrok version

# Verificar authtoken
ngrok config check

# Configurar authtoken
ngrok config add-authtoken TU_AUTHTOKEN
```

### Problema: "Error configurando webhook en producción"
```bash
# Verificar token JWT
curl -H "Authorization: Bearer TU_TOKEN" https://tdbot.gocode.cl/api/health

# Si falla, obtener nuevo token desde admin panel
```

### Problema: "No llegan notificaciones"
```bash
# Verificar endpoint
curl http://localhost:8765/health

# Hacer push de prueba
git commit --allow-empty -m "test CI notification"
git push

# Revisar logs del servidor de producción
```

## 🔧 **Endpoints Disponibles**

### `POST /ci-notification`
Endpoint principal para recibir notificaciones del servidor de producción.

### `GET /health`
Health check del servidor webhook local.
```bash
curl http://localhost:8765/health
# Response: {"status":"ok","tunnel":"https://abc123.ngrok-free.app","timestamp":"2025-01-15T10:30:00.000Z"}
```

### `POST /reconfigure`
Reconfigurar webhook manualmente.
```bash
curl -X POST http://localhost:8765/reconfigure
# Response: {"success":true,"message":"Webhook reconfigurado"}
```

## 🎯 **Flujo Completo**

1. **Developer** hace `git push`
2. **GitHub webhook** notifica al servidor de producción
3. **Servidor de producción** ejecuta pipeline de CI/CD
4. **Servidor de producción** envía notificación a tu túnel ngrok
5. **Tu máquina local** recibe y muestra la notificación
6. **Tú** ves el resultado del pipeline en tiempo real

## ⚡ **Tips de Productividad**

1. **Dejar corriendo**: El servidor webhook puede quedar corriendo todo el día
2. **URL fija**: Con ngrok pro puedes tener URLs fijas que no cambien
3. **Múltiples proyectos**: Puedes usar el mismo webhook para múltiples repos
4. **Notificaciones móviles**: Agregar integración con WhatsApp/Telegram
5. **Filtros**: Configurar para recibir solo errores o solo éxitos

---

**🚀 ¡Listo!** Ahora tienes notificaciones de CI/CD en tiempo real directamente en tu máquina de desarrollo.
