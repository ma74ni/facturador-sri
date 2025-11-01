# Guía de Despliegue - Facturador Electrónico SRI

Sistema de facturación electrónica SRI Ecuador - Guía completa para despliegue en **Staging** y **Producción**.

## 📋 Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────┐
│                  ARQUITECTURA                         │
└──────────────────────────────────────────────────────┘

Frontend (Next.js 14)          Backend (NestJS)         Signing Service (Java)
    Port: 3001           →        Port: 3000        →        Port: 18081
    ┌──────────┐               ┌──────────┐              ┌──────────────┐
    │ Vercel/  │  HTTP/REST    │ Railway/ │   HTTP       │  Fly.io/     │
    │ Netlify  │ ───────────→  │ Render   │ ──────────→  │  Railway     │
    └──────────┘               └──────────┘              └──────────────┘
                                    │                           │
                                    ↓                           ↓
                              ┌──────────┐              ┌──────────────┐
                              │PostgreSQL│              │ Certificados │
                              │  Prisma  │              │   .p12       │
                              └──────────┘              └──────────────┘
                                    │
                                    ↓
                              ┌──────────┐
                              │ Redis    │
                              │  Bull    │
                              └──────────┘
                                    │
                                    ↓
                              ┌──────────┐
                              │Cloudflare│
                              │    R2    │
                              │ Storage  │
                              └──────────┘
                                    │
                                    ↓
                              ┌──────────┐
                              │   SRI    │
                              │   SOAP   │
                              └──────────┘
```

## 🚀 Despliegue STAGING - Guía Rápida

### Prerequisitos

- ✅ Cuenta en Render
- ✅ Cuenta en Netlify
- ✅ Cuenta en Cloudflare (para R2)
- ✅ Certificado digital .p12 de prueba
- ✅ Cuenta Mailjet (opcional pero recomendado)

### Paso 1: Preparar Repositorio

```bash
# Asegurar que todo esté commiteado
git status
git add .
git commit -m "Prepare for staging deployment"
git push origin dev
```

### Paso 2: Configurar Cloudflare R2 (Storage)

1. **Crear cuenta en Cloudflare**: https://dash.cloudflare.com/sign-up
2. **Crear bucket R2**:
   - Ir a R2 → Create bucket
   - Nombre: `facturador-sri-staging`
   - Region: Automático
3. **Crear API Token**:
   - R2 → Manage R2 API Tokens → Create API Token
   - Tipo: Edit
   - Guardar: `Access Key ID` y `Secret Access Key`
4. **Obtener endpoint**:
   - Bucket → Settings → S3 API endpoint
   - Ejemplo: `https://xxxxx.r2.cloudflarestorage.com`

### Paso 3: Desplegar Signing Service

#### Opción A: Railway (Recomendado)

```bash
cd signing-service

# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Configurar variables de entorno
railway variables set SPRING_PROFILES_ACTIVE=production
railway variables set JAVA_OPTS="-Xmx512m -Xms256m"

# Deploy
railway up
```

#### Opción B: Fly.io

```bash
cd signing-service

# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Lanzar app
fly launch --name facturador-signing-staging

# Deploy
fly deploy
```

**Obtener URL del servicio** (ejemplo: `https://facturador-signing-staging.fly.dev`)

### Paso 4: Desplegar Backend (facturacion-core)

#### Opción A: Railway (Recomendado)

1. **Ir a Railway**: https://railway.app
2. **New Project** → Deploy from GitHub repo
3. **Seleccionar** el repositorio `facturador-sri`
4. **Add PostgreSQL** database
5. **Add Redis** database
6. **Configurar variables de entorno**:

```env
# Database (auto-generada por Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (auto-generada por Railway)
REDIS_URL=${{Redis.REDIS_URL}}

# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# JWT
JWT_SECRET=tu-secret-super-seguro-staging-2025

# CORS
CORS_ORIGINS=https://tu-frontend-staging.vercel.app

# Cloudflare R2 (del Paso 2)
R2_ACCOUNT_ID=tu-account-id
R2_ACCESS_KEY_ID=tu-access-key-id
R2_SECRET_ACCESS_KEY=tu-secret-access-key
R2_BUCKET_NAME=facturador-sri-staging
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com

# Signing Service (del Paso 3)
SIGNING_SERVICE_URL=https://facturador-signing-staging.fly.dev

# SRI URLs (ambiente de pruebas)
SRI_WS_RECEPTION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_WS_AUTHORIZATION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

# Mailjet (opcional)
MAILJET_API_KEY=tu-mailjet-api-key
MAILJET_SECRET_KEY=tu-mailjet-secret-key
MAILJET_FROM_EMAIL=noreply@tudominio.com
MAILJET_FROM_NAME=Facturador SRI Staging
```

7. **Configurar Build**:
   - Root Directory: `/packages/facturacion-core`
   - Build Command: `npm run build`
   - Start Command: `npm run start:prod`

8. **Ejecutar migraciones**:

```bash
# En Railway CLI
railway run npx prisma db push

# O en el dashboard: Settings → Deploy → Manual Deploy
```

**Obtener URL** (ejemplo: `https://facturador-api-staging.up.railway.app`)

#### Opción B: Render

1. **Ir a Render**: https://render.com
2. **New → Web Service**
3. **Connect repository**
4. Configurar:
   - Name: `facturador-api-staging`
   - Root Directory: `packages/facturacion-core`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
5. **Add PostgreSQL database** (Plan gratuito 90 días)
6. **Add Redis** (Externo: Upstash Redis gratis)
7. **Environment Variables**: (las mismas del paso Railway)

### Paso 5: Desplegar Frontend (web-facturacion)

#### Opción A: Vercel (Recomendado)

1. **Ir a Vercel**: https://vercel.com
2. **Import Project** desde GitHub
3. **Configure Project**:
   - Framework Preset: `Next.js`
   - Root Directory: `packages/web-facturacion`
   - Build Command: `cd ../.. && pnpm install && pnpm --filter web-facturacion build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

4. **Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://facturador-api-staging.up.railway.app/api/v1
NEXT_PUBLIC_APP_NAME=Facturador SRI - Staging
NEXT_PUBLIC_ENV=staging
```

5. **Deploy**

**Obtener URL** (ejemplo: `https://facturador-sri-staging.vercel.app`)

#### Opción B: Netlify

1. **Ir a Netlify**: https://netlify.com
2. **Import from Git**
3. Configurar:
   - Base directory: `packages/web-facturacion`
   - Build command: `cd ../.. && pnpm install && pnpm --filter web-facturacion build`
   - Publish directory: `packages/web-facturacion/.next`
4. **Environment Variables**: (las mismas de Vercel)

### Paso 6: Actualizar CORS en Backend

Una vez tengas la URL del frontend, actualiza la variable `CORS_ORIGINS` en Railway:

```env
CORS_ORIGINS=https://facturador-sri-staging.vercel.app,http://localhost:3001
```

### Paso 7: Verificación Post-Deployment

```bash
# 1. Verificar Signing Service
curl https://facturador-signing-staging.fly.dev/api/v1/signature/health

# 2. Verificar Backend
curl https://facturador-api-staging.up.railway.app/api/v1/health

# 3. Verificar Frontend
# Abrir en navegador: https://facturador-sri-staging.vercel.app
```

**Checklist de verificación:**

- [ ] Signing service responde con health OK
- [ ] Backend API responde /health
- [ ] Swagger docs accesibles en `/api/docs`
- [ ] Frontend carga correctamente
- [ ] Login funciona
- [ ] Registro de usuario funciona
- [ ] Crear cliente funciona
- [ ] Crear producto funciona
- [ ] Crear factura funciona
- [ ] Generar XML funciona
- [ ] Firmar XML funciona (con certificado de prueba)
- [ ] Envío al SRI funciona (ambiente TEST)
- [ ] Email se envía correctamente
- [ ] Archivos se suben a R2

---

## 🏢 Despliegue PRODUCCIÓN

### Diferencias vs Staging

| Aspecto | Staging | Producción |
|---------|---------|------------|
| Ambiente SRI | TEST (celcer) | PROD (cel) |
| Certificados | Prueba | Producción válidos |
| Database | Menor capacidad | Mayor capacidad |
| Backups | Opcional | Obligatorio |
| Monitoring | Opcional | Obligatorio |
| Rate Limiting | Flexible | Estricto |
| Logs | Detallados | Solo errores |

### Variables de Entorno Producción

```env
# Application
NODE_ENV=production

# SRI URLs PRODUCCIÓN
SRI_WS_RECEPTION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_WS_AUTHORIZATION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

# Security
JWT_SECRET=<usar-secreto-muy-fuerte-aleatorio>
CORS_ORIGINS=https://app.tudominio.com

# Storage
R2_BUCKET_NAME=facturador-sri-production

# Email
MAILJET_FROM_EMAIL=noreply@tudominio.com
```

### Recomendaciones Adicionales para Producción

1. **Custom Domain**:
   - Backend: `api.tudominio.com`
   - Frontend: `app.tudominio.com`

2. **Monitoring**:
   - Sentry para error tracking
   - New Relic / Datadog para performance
   - Uptime Robot para availability

3. **Backups**:
   - PostgreSQL: Backups automáticos diarios
   - R2: Versioning habilitado

4. **Rate Limiting**:
   ```typescript
   // Ya implementado en NestJS
   @UseGuards(ThrottlerGuard)
   ```

5. **SSL/TLS**: Automático en todas las plataformas

6. **CI/CD**: GitHub Actions para tests automáticos

---

## 💾 Opciones de Servicios

### Backend + Database

#### Railway ⭐ (Recomendado para Staging)
- **Gratis**: $5 crédito mensual
- **PostgreSQL + Redis incluidos**
- **Auto-deploy desde GitHub**
- **Escalable**: Pay-as-you-go
- **URL**: https://railway.app

#### Render
- **Gratis**: 750 horas/mes
- **PostgreSQL**: $7/mes después de 90 días
- **SSL automático**
- **URL**: https://render.com

#### Fly.io
- **Gratis**: 3 VMs pequeñas
- **PostgreSQL incluido**
- **Global deployment**
- **URL**: https://fly.io

### Frontend

#### Vercel ⭐ (Recomendado)
- **Gratis**: Despliegues ilimitados
- **Perfect para Next.js**
- **CDN global**
- **URL**: https://vercel.com

#### Netlify
- **Gratis**: 100 GB bandwidth/mes
- **SSL automático**
- **URL**: https://netlify.com

#### Cloudflare Pages
- **Gratis**: Ilimitado
- **CDN integrado**
- **URL**: https://pages.cloudflare.com

### Storage

#### Cloudflare R2 ⭐ (Recomendado)
- **Gratis**: 10 GB/mes
- **Sin costos de egreso**
- **Compatible S3**
- **URL**: https://cloudflare.com/products/r2/

#### AWS S3
- **Gratis**: 5 GB primer año
- **Muy maduro**
- **Costos de transferencia**
- **URL**: https://aws.amazon.com/s3/

#### Backblaze B2
- **Gratis**: 10 GB
- **Muy económico**: $0.005/GB/mes
- **Compatible S3**
- **URL**: https://backblaze.com/b2/

---

## 📊 Estimación de Costos

### Staging (Gratis)
| Servicio | Costo |
|----------|-------|
| Railway (Backend + DB + Redis) | $0 (crédito $5/mes) |
| Fly.io (Signing Service) | $0 |
| Vercel (Frontend) | $0 |
| Cloudflare R2 (Storage) | $0 (hasta 10 GB) |
| **TOTAL** | **$0/mes** |

### Producción Pequeña (100-500 usuarios/mes)
| Servicio | Costo |
|----------|-------|
| Railway Pro | $15-25/mes |
| Fly.io | $5-10/mes |
| Vercel Pro (opcional) | $0 (hobby) o $20 |
| Cloudflare R2 | $0.50-2/mes |
| Mailjet | $0 (hasta 6k emails) |
| **TOTAL** | **$20-60/mes** |

### Producción Media (500-2000 usuarios/mes)
| Servicio | Costo |
|----------|-------|
| Railway/VPS | $50-100/mes |
| Fly.io | $15-25/mes |
| Vercel Pro | $20/mes |
| Cloudflare R2 | $2-5/mes |
| Mailjet | $15/mes |
| Monitoring (Sentry) | $26/mes |
| **TOTAL** | **$130-190/mes** |

---

## 🔧 Configuración de Monorepo para Deploy

### Build Commands por Plataforma

#### Railway / Render (Backend)

```json
// package.json en /packages/facturacion-core
{
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

**Railway settings**:
- Root Directory: `packages/facturacion-core`
- Build Command: `npm install && npm run build && npm run prisma:deploy`
- Start Command: `npm run start:prod`

#### Vercel (Frontend)

```json
// vercel.json en la raíz
{
  "buildCommand": "cd packages/web-facturacion && pnpm install && pnpm build",
  "outputDirectory": "packages/web-facturacion/.next",
  "installCommand": "npm install -g pnpm && pnpm install"
}
```

---

## 🔒 Seguridad

### Checklist de Seguridad

- [ ] **Variables de entorno**: Nunca en código
- [ ] **HTTPS**: Obligatorio (automático en plataformas)
- [ ] **CORS**: Solo orígenes permitidos
- [ ] **Rate Limiting**: `@nestjs/throttler` configurado
- [ ] **Helmet**: Headers de seguridad
- [ ] **Validation**: `class-validator` en DTOs
- [ ] **JWT Secret**: Aleatorio y fuerte (min 32 caracteres)
- [ ] **Database**: Conexión SSL
- [ ] **Backups**: Automáticos habilitados
- [ ] **Logs**: No loguear información sensible
- [ ] **Certificados**: .p12 solo en variables de entorno (Base64)

### Ejemplo: Almacenar Certificado .p12

```bash
# Convertir .p12 a Base64
base64 -i certificado.p12 | tr -d '\n' > cert_base64.txt

# En Railway/Render, agregar variable:
CERTIFICATE_BASE64=<contenido-de-cert_base64.txt>
CERTIFICATE_PASSWORD=tu-password
```

---

## 📝 Troubleshooting

### Error: "Cannot connect to database"
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Test de conexión
npx prisma db pull
```

### Error: "Prisma migrations failed"
```bash
# Opción 1: Deploy migrations
npx prisma migrate deploy

# Opción 2: Push schema (staging)
npx prisma db push
```

### Error: "Signing service timeout"
```bash
# Verificar health del signing service
curl https://your-signing-service.fly.dev/api/v1/signature/health

# Ver logs
railway logs
# o
fly logs
```

### Error: "SRI rechaza XML"
- ✅ Verificar que uses certificado válido para el ambiente
- ✅ Validar XML contra XSD del SRI
- ✅ Verificar clave de acceso (49 dígitos)
- ✅ Revisar logs del SRI en respuesta SOAP

### Error: "R2 upload failed"
```bash
# Verificar credenciales
# Verificar permisos del bucket
# Revisar endpoint correcto
```

---

## 📚 Recursos

- [NestJS Production](https://docs.nestjs.com/faq/serverless)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Railway Docs](https://docs.railway.app/)
- [Vercel Docs](https://vercel.com/docs)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [SRI Documentación](https://www.sri.gob.ec/facturacion-electronica)

---

## 🆘 Soporte

Para ayuda con el deployment:
- Ver `/README.md` para guía general
- Ver `/CLAUDE.md` para arquitectura
- Ver `packages/*/README.md` para cada servicio

---

**Versión**: 1.4.0
**Última actualización**: 2025-10-31
