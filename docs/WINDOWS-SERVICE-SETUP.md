# Windows Service Setup - CI/CD Webhook Server

## 🎯 Objetivo

Crear un **servicio de Windows** para que el webhook server local se ejecute automáticamente:
- ✅ Auto-inicio al arrancar Windows
- ✅ Ejecuta en segundo plano siempre 
- ✅ Se reinicia automáticamente si falla
- ✅ No requiere sesión de usuario activa

## 📋 Requisitos Previos

1. **Node.js instalado** (verificar: `node --version`)
2. **Permisos de Administrador** para instalar servicios
3. **Puerto 8765 libre** en la máquina local

## 🚀 Instalación del Servicio

### Opción 1: Script Automático (Recomendado)

1. **Abrir PowerShell como Administrador**:
   - Click derecho en PowerShell
   - Seleccionar "Ejecutar como administrador"

2. **Navegar al directorio del proyecto**:
   ```powershell
   cd D:\devel\node\cicd-system
   ```

3. **Ejecutar el script de control**:
   ```powershell
   scripts\service-control.bat
   ```

4. **Seleccionar opción 1** para instalar el servicio

### Opción 2: Instalación Manual

1. **Como Administrador**, ejecutar:
   ```bash
   cd D:\devel\node\cicd-system
   node scripts\install-windows-service.js
   ```

## 🔧 Gestión del Servicio

### Usando el Script de Control

```powershell
# Ejecutar como Administrador
scripts\service-control.bat
```

**Opciones disponibles**:
- `1` - Instalar servicio 
- `2` - Desinstalar servicio
- `3` - Iniciar servicio
- `4` - Parar servicio  
- `5` - Reiniciar servicio
- `6` - Ver estado del servicio
- `7` - Ver logs en Event Viewer
- `8` - Probar endpoints del webhook

### Comandos Windows Nativos

```powershell
# Ver estado del servicio
sc query "CICD-Webhook-Server"

# Iniciar servicio
sc start "CICD-Webhook-Server"

# Parar servicio
sc stop "CICD-Webhook-Server"

# Configurar auto-inicio
sc config "CICD-Webhook-Server" start= auto
```

### Administrador de Servicios (GUI)

1. Presionar `Win + R`
2. Escribir `services.msc`
3. Buscar **"CICD-Webhook-Server"**
4. Click derecho → Propiedades para configurar

## 🔍 Verificación del Servicio

### 1. Verificar Estado
```powershell
# Verificar que el servicio esté corriendo
sc query "CICD-Webhook-Server"

# Debe mostrar: STATE: 4 RUNNING
```

### 2. Test de Conectividad
```bash
# Health check
curl http://localhost:8765/health

# Respuesta esperada:
# {"status":"ok","timestamp":"...","projects":2}
```

### 3. Test de Webhook
```bash
# Endpoint de proyectos
curl http://localhost:8765/api/projects

# Test de webhook (simulado)
curl -X POST http://localhost:8765/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"GitHub webhook test"}'
```

## 📊 Configuración del Servicio

### Variables de Entorno

El servicio se configura automáticamente con:

```javascript
env: [
  {
    name: "NODE_ENV",
    value: "production"
  },
  {
    name: "WEBHOOK_PORT", 
    value: "8765"
  },
  {
    name: "DISABLE_NGROK",
    value: "true"  // ✅ Sin ngrok - solo servidor local
  }
]
```

### Archivos de Configuración

- **Script principal**: `src/webhook-server-multi.js`
- **Base de datos**: `data/cicd-system.db`
- **Logs del servicio**: Event Viewer → Windows Logs → Application

## 🔄 Integración con Túnel SSH

Una vez instalado el servicio de Windows:

1. **Servicio Windows** ejecuta webhook en `localhost:8765`
2. **Servicio SSH** (separado) crea túnel al servidor remoto
3. **Servidor remoto** recibe webhooks en `cicd.gocode.cl`

Ambos servicios pueden coexistir:
- **Local**: Para desarrollo y testing
- **Remoto**: Para webhooks reales de GitHub

## 🗑️ Desinstalación

### Usando Script de Control
```powershell
scripts\service-control.bat
# Seleccionar opción 2
```

### Manual
```powershell
# Como Administrador
node scripts\uninstall-windows-service.js
```

## 🐛 Troubleshooting

### Servicio No Inicia
```powershell
# Verificar logs en Event Viewer
eventvwr.msc

# Buscar eventos de "CICD-Webhook-Server"
```

### Puerto en Uso
```powershell
# Ver qué proceso usa el puerto 8765
netstat -ano | findstr :8765

# Terminar proceso si es necesario
taskkill /PID <numero_pid> /F
```

### Permisos Insuficientes
- Asegurar que se ejecuta como **Administrador**
- Verificar permisos de escritura en directorio del proyecto

### Base de Datos No Accesible
```powershell
# Verificar que existe la carpeta data/
mkdir data

# Verificar permisos de escritura
echo test > data\test.txt
del data\test.txt
```

## 📋 Logs y Monitoreo

### Event Viewer
1. `eventvwr.msc`
2. Windows Logs → Application  
3. Filtrar por "CICD-Webhook-Server"

### Logs de Aplicación
Los logs de la aplicación aparecen en Event Viewer bajo:
- **Source**: CICD-Webhook-Server
- **Event ID**: Varios (depende del tipo de evento)

### Monitoreo en Tiempo Real
```powershell
# Seguir logs del servicio
Get-EventLog -LogName Application -Source "CICD-Webhook-Server" -Newest 10

# O usar el script de control
scripts\service-control.bat
# Opción 7: Ver logs
```

---

## ✅ Resultado Final

Una vez configurado correctamente:

- 🟢 **Servicio ejecutándose** automáticamente al iniciar Windows
- 🟢 **Webhook server** disponible en `http://localhost:8765`  
- 🟢 **Auto-reinicio** si el servicio falla
- 🟢 **Logs centralizados** en Event Viewer
- 🟢 **Control completo** via GUI y scripts

**¡El sistema estará listo para recibir webhooks locales 24/7!**