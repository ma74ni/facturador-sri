# 🚀 Despliegue Staging - Facturador SRI

## 📊 URLs del Sistema

### Frontend
- **URL**: https://boisterous-griffin-ebe677.netlify.app
- **Plataforma**: Netlify
- **Branch**: dev

### Backend API
- **URL**: https://facturador-api-staging.onrender.com
- **API Docs (Swagger)**: https://facturador-api-staging.onrender.com/api/docs
- **Health Check**: https://facturador-api-staging.onrender.com/api/v1/health
- **Plataforma**: Render
- **Branch**: dev

### Signing Service
- **URL**: (tu URL de Railway)
- **Plataforma**: Railway
- **Branch**: dev

### Base de Datos
- **Proveedor**: Supabase
- **Database**: PostgreSQL
- **Schema**: facturacion_core

### Storage
- **Proveedor**: Cloudflare R2
- **Bucket**: facturador-sri-staging

### Email
- **Proveedor**: Mailjet
- **From Email**: facturacion@siete8.com
- **Domain**: siete8.com

---

## ✅ Checklist de Verificación

### 1. Backend API
- [ ] Health endpoint responde: `https://facturador-api-staging.onrender.com/api/v1/health`
- [ ] Swagger docs accesible: `https://facturador-api-staging.onrender.com/api/docs`
- [ ] Base de datos conectada correctamente

### 2. Frontend
- [ ] Página principal carga: `https://boisterous-griffin-ebe677.netlify.app`
- [ ] Página de login accesible: `https://boisterous-griffin-ebe677.netlify.app/login`
- [ ] Console del navegador sin errores de conexión

### 3. Funcionalidad Básica
- [ ] Registro de nuevo usuario funciona
- [ ] Login funciona y genera token JWT
- [ ] Dashboard carga después del login
- [ ] Crear empresa funciona
- [ ] Crear cliente funciona
- [ ] Crear producto funciona

### 4. Funcionalidad de Facturación (Prueba Completa)
- [ ] Crear factura
- [ ] Generar XML
- [ ] Firmar XML (Signing Service)
- [ ] Subir archivos a R2
- [ ] Enviar al SRI (ambiente TEST)
- [ ] Enviar email con PDF y XML

---

## 🔍 Comandos de Verificación

### Verificar Backend Health
```bash
curl https://facturador-api-staging.onrender.com/api/v1/health
```

Esperado: `{"status":"ok","timestamp":"..."}`

### Verificar Swagger Docs
Abrir en navegador:
```
https://facturador-api-staging.onrender.com/api/docs
```

### Verificar Frontend
Abrir en navegador:
```
https://boisterous-griffin-ebe677.netlify.app
```

---

## ⚙️ Variables de Entorno Configuradas

### Netlify (Frontend)
```env
NEXT_PUBLIC_API_URL=https://facturador-api-staging.onrender.com/api/v1
NEXT_PUBLIC_APP_NAME=Facturador SRI - Staging
NEXT_PUBLIC_ENV=staging
```

### Render (Backend)
```env
DATABASE_URL=postgresql://postgres:...@db.lowzapfcplbbacqahatd.supabase.co:5432/postgres
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
JWT_SECRET=staging-facturador-sri-super-secret-2025-min-32-chars-random-xyz789
CORS_ORIGINS=https://boisterous-griffin-ebe677.netlify.app,http://localhost:3001
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=facturador-sri-staging
R2_ENDPOINT=https://...r2.cloudflarestorage.com
SIGNING_SERVICE_URL=https://...up.railway.app
SRI_WS_RECEPTION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_WS_AUTHORIZATION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
SRI_WS_RECEPTION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_WS_AUTHORIZATION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
MAILJET_API_KEY=...
MAILJET_SECRET_KEY=...
MAILJET_FROM_EMAIL=facturacion@siete8.com
MAILJET_FROM_NAME=Facturador SRI Staging
```

### Railway (Signing Service)
```env
SPRING_PROFILES_ACTIVE=production
JAVA_OPTS=-Xmx512m -Xms256m
PORT=8081
```

---

## 🐛 Troubleshooting

### Frontend no conecta con Backend
1. Verificar que `NEXT_PUBLIC_API_URL` en Netlify esté correcta
2. Verificar CORS en Render incluye URL de Netlify
3. Abrir Console del navegador para ver errores

### Backend responde 500 o errores de DB
1. Verificar que `DATABASE_URL` en Render esté correcta
2. Verificar que Supabase esté activo
3. Revisar logs en Render Dashboard

### Signing Service no responde
1. Verificar que Railway esté activo
2. Verificar `SIGNING_SERVICE_URL` en Render
3. Revisar logs en Railway

### Archivos no se suben a R2
1. Verificar credenciales R2 en Render
2. Verificar que el bucket existe en Cloudflare
3. Verificar permisos del API token de R2

### Emails no se envían
1. Verificar credenciales Mailjet en Render
2. Verificar que el sender email esté verificado en Mailjet
3. Revisar logs en Render

---

## ⚠️ Importante - Limitaciones Plan Gratuito

### Render Free
- ⏱️ El servicio se "duerme" después de 15 minutos de inactividad
- ⏱️ Primera petición después del sleep tarda 30-60 segundos
- 💾 750 horas/mes de compute time

### Supabase Free
- 💾 500MB de base de datos
- 🔄 2GB de transferencia/mes
- ⏱️ Pausa automática después de 1 semana de inactividad

### Railway Free
- 💰 $5 de crédito mensual
- ⚡ ~500 horas de ejecución/mes con servicio pequeño

### Netlify Free
- 📊 100GB bandwidth/mes
- 🔄 300 minutos de build/mes
- ✅ Deployments ilimitados

---

## 📝 Notas

- **Ambiente SRI**: TEST (celcer.sri.gob.ec)
- **Certificados**: Usar certificados de prueba del SRI
- **Monorepo**: pnpm workspaces
- **CI/CD**: Push a `dev` branch auto-deploys en todos los servicios

---

## 🎯 Próximos Pasos Sugeridos

1. **Probar flujo completo** de facturación
2. **Configurar dominio personalizado** (opcional)
3. **Agregar monitoring** (Sentry, LogRocket)
4. **Setup de backups** automáticos de DB
5. **Documentar APIs** adicionales en Swagger
6. **Agregar tests E2E** con Playwright/Cypress

---

**Versión**: 1.0.0
**Fecha**: 2025-11-03
**Estado**: ✅ Desplegado en Staging
