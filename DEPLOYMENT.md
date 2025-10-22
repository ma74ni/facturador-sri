# Guía de Despliegue - Facturador Electrónico SRI

## 📦 Almacenamiento de Archivos (XMLs, PDFs, Logos)

### Opción 1: Cloudflare R2 ⭐ (Recomendada)
- **Gratis:** 10 GB de almacenamiento/mes
- **Compatible con S3:** Usa las mismas librerías que AWS S3
- **Sin costos de egreso:** No pagas por descargas (esto es MUY importante)
- **Pricing escalable:** $0.015/GB/mes después del tier gratuito
- **Perfecto para:** XMLs firmados, PDFs de facturas, logos de empresas
- **URL:** https://www.cloudflare.com/products/r2/

### Opción 2: AWS S3
- **Gratis (primer año):** 5 GB de almacenamiento
- **Después:** ~$0.023/GB/mes
- **Desventaja:** Cobran por transferencia de datos de salida
- **Ventaja:** Muy maduro y con muchas integraciones
- **URL:** https://aws.amazon.com/s3/

### Opción 3: Supabase Storage
- **Gratis:** 1 GB de almacenamiento
- **Después:** $0.021/GB/mes
- **Ventaja:** Integrado con PostgreSQL de Supabase si lo usas
- **URL:** https://supabase.com/storage

### Opción 4: Backblaze B2
- **Gratis:** 10 GB de almacenamiento
- **Muy económico:** $0.005/GB/mes (el más barato)
- **Compatible con S3**
- **URL:** https://www.backblaze.com/b2/cloud-storage.html

---

## 🚀 Despliegue del Backend (NestJS + PostgreSQL)

### Opción 1: Railway ⭐ (Recomendada)
- **Gratis:** $5 de crédito mensual (suficiente para empezar)
- **PostgreSQL incluido:** Base de datos incluida
- **Fácil deploy:** Conectas tu repo GitHub
- **Escalable:** Pay-as-you-go después
- **URL:** https://railway.app

**Pasos básicos:**
1. Crear cuenta en Railway
2. Conectar repositorio GitHub
3. Crear servicio PostgreSQL
4. Configurar variables de entorno
5. Deploy automático

### Opción 2: Render
- **Gratis:**
  - Web Service: 750 horas/mes
  - PostgreSQL: 90 días gratis, luego $7/mes
- **Auto-deploy desde GitHub**
- **SSL gratis**
- **Desventaja:** Los servicios gratuitos se "duermen" tras inactividad
- **URL:** https://render.com

### Opción 3: Fly.io
- **Gratis:**
  - 3 VMs pequeñas (256 MB RAM)
  - 3 GB de almacenamiento persistente
  - 160 GB de transferencia
- **PostgreSQL incluido** en tier gratuito
- **Perfecto para microservicios**
- **URL:** https://fly.io

### Opción 4: Vercel (Solo para backend serverless)
- **Gratis:** Funciones serverless ilimitadas
- **Desventaja:** No es ideal para NestJS completo (mejor para Next.js)
- **Necesitarías:** Base de datos externa
- **URL:** https://vercel.com

---

## 🎨 Despliegue del Frontend (React/Next.js/Vue/Angular)

### Opción 1: Vercel ⭐ (Recomendada)
- **Gratis:** Despliegues ilimitados
- **Perfecto para:** React, Next.js, Vue, Angular
- **CDN global**
- **SSL automático**
- **URL:** https://vercel.com

### Opción 2: Netlify
- **Similar a Vercel**
- **100 GB de ancho de banda/mes gratis**
- **SSL automático**
- **URL:** https://netlify.com

### Opción 3: Cloudflare Pages
- **Gratis:** Ilimitado
- **Despliegues ilimitados**
- **Integrado con CDN de Cloudflare**
- **URL:** https://pages.cloudflare.com

---

## 💾 Base de Datos PostgreSQL (Si necesitas DB independiente)

### Opción 1: Supabase ⭐ (Recomendada)
- **Gratis:**
  - 500 MB de base de datos
  - 1 GB de almacenamiento de archivos
  - 2 GB de transferencia
- **Incluye:** Auth, Storage, Real-time
- **Escalable:** $25/mes plan pro
- **URL:** https://supabase.com

### Opción 2: Neon
- **Gratis:**
  - 0.5 GB de almacenamiento
  - Serverless PostgreSQL
- **Ventaja:** Scale to zero (no pagas cuando no usas)
- **URL:** https://neon.tech

### Opción 3: ElephantSQL
- **Gratis:** 20 MB (muy limitado)
- **Compartido**
- **URL:** https://www.elephantsql.com

---

## 🏆 Stack Recomendado (Gratis → Escalable)

```
┌─────────────────────────────────────────┐
│   ARQUITECTURA RECOMENDADA              │
└─────────────────────────────────────────┘

🔹 Backend + DB: Railway
   • $5/mes gratis inicialmente
   • PostgreSQL incluido
   • Fácil escalar
   • Deploy automático desde GitHub

🔹 Almacenamiento: Cloudflare R2
   • 10 GB gratis/mes
   • Sin costos de descarga
   • Compatible con S3 (usar @aws-sdk/client-s3)

🔹 Frontend: Vercel
   • Gratis ilimitado
   • Deploy automático desde GitHub
   • CDN global

🔹 Servicio de Firma XML: Fly.io o Railway
   • Microservicio separado
   • Alta disponibilidad
```

---

## 📊 Estimación de Costos

### Fase Inicial (0-3 meses)
| Servicio | Costo |
|----------|-------|
| Railway (Backend + PostgreSQL) | $0 (crédito de $5/mes) |
| Cloudflare R2 (Almacenamiento) | $0 (hasta 10 GB) |
| Vercel (Frontend) | $0 |
| **TOTAL** | **$0/mes** |

### Crecimiento Moderado (100-500 usuarios)
| Servicio | Costo Estimado |
|----------|----------------|
| Railway (Backend + PostgreSQL) | $10-20/mes |
| Cloudflare R2 (20-50 GB) | $0.30-0.75/mes |
| Vercel (Frontend) | $0 (hobby plan) |
| **TOTAL** | **$10-25/mes** |

### Crecimiento Alto (500+ usuarios)
| Servicio | Costo Estimado |
|----------|----------------|
| Railway o VPS dedicado | $20-50/mes |
| Cloudflare R2 (100+ GB) | $1.50+/mes |
| Vercel Pro (opcional) | $20/mes |
| **TOTAL** | **$40-70/mes** |

---

## 🔧 Configuración Necesaria

### Variables de Entorno para Producción

```bash
# Base de datos
DATABASE_URL=postgresql://user:password@host:port/db

# JWT
JWT_SECRET=your-secure-secret-key

# SRI
SRI_TEST_URL=https://celcer.sri.gob.ec
SRI_PROD_URL=https://cel.sri.gob.ec
SRI_AUTH_TEST_URL=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
SRI_AUTH_PROD_URL=https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline

# Almacenamiento (Cloudflare R2 o S3)
STORAGE_ENDPOINT=https://your-account.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=your-access-key
STORAGE_SECRET_ACCESS_KEY=your-secret-key
STORAGE_BUCKET=facturador-sri
STORAGE_REGION=auto

# Firma Digital
XML_SIGNATURE_SERVICE_URL=https://your-signature-service.fly.dev

# Aplicación
NODE_ENV=production
PORT=3000
```

### Archivos Importantes para Deploy

1. **Dockerfile** (si usas contenedores)
2. **docker-compose.yml** (para desarrollo local)
3. **.dockerignore**
4. **railway.json** o **render.yaml** (según plataforma)
5. **prisma/schema.prisma** (migraciones automáticas)

---

## 📝 Checklist de Deploy

### Pre-Deploy
- [ ] Configurar variables de entorno en la plataforma
- [ ] Asegurar que las migraciones de Prisma estén listas
- [ ] Configurar servicio de almacenamiento (R2/S3)
- [ ] Configurar servicio de firma XML
- [ ] Probar localmente con variables de producción

### Deploy
- [ ] Conectar repositorio a la plataforma
- [ ] Configurar build command: `npm run build`
- [ ] Configurar start command: `npm run start:prod`
- [ ] Ejecutar migraciones: `npx prisma migrate deploy`
- [ ] Verificar logs de deploy

### Post-Deploy
- [ ] Probar endpoints principales
- [ ] Verificar conexión a base de datos
- [ ] Verificar almacenamiento de archivos
- [ ] Verificar firma y envío al SRI
- [ ] Configurar monitoreo (opcional: Sentry, LogRocket)
- [ ] Configurar backups de base de datos

---

## 🔒 Seguridad en Producción

### Recomendaciones
1. **Nunca commits secrets** - Usar variables de entorno
2. **HTTPS obligatorio** - Todas las plataformas lo incluyen
3. **Rate limiting** - Implementar en NestJS con `@nestjs/throttler`
4. **Validación de datos** - Ya implementado con `class-validator`
5. **CORS configurado** - Limitar orígenes permitidos
6. **Helmet.js** - Headers de seguridad
7. **Backups automáticos** - Railway y Supabase los incluyen

---

## 📚 Recursos Adicionales

- [NestJS Deployment](https://docs.nestjs.com/faq/serverless)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Railway Docs](https://docs.railway.app/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [SRI Documentación](https://www.sri.gob.ec/facturacion-electronica)

---

## 🆘 Troubleshooting Común

### Error: Cannot connect to database
- Verificar DATABASE_URL
- Verificar que la DB esté activa
- Revisar reglas de firewall

### Error: Prisma migrations failed
- Ejecutar manualmente: `npx prisma migrate deploy`
- Verificar que el schema esté sincronizado

### Error: SRI no responde
- Verificar URLs del SRI según ambiente
- Revisar logs de la petición SOAP
- Validar formato del XML

### Error: Storage upload failed
- Verificar credenciales de R2/S3
- Verificar permisos del bucket
- Revisar tamaño máximo de archivo

---

**Última actualización:** 2025-10-21
