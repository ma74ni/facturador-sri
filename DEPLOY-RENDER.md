# Deploy en Render (staging) — todo en una cuenta

Consolida los dos servicios de backend en **una sola cuenta de Render** usando el
Blueprint `render.yaml` de la raíz. El frontend sigue en Netlify. La base de
datos sigue en Neon.

```
Netlify (web-facturacion)
      │  NEXT_PUBLIC_API_URL
      ▼
facturador-core-staging      (Render · Node · packages/facturacion-core)
      │  SIGNING_SERVICE_URL
      ▼
facturador-signing-staging   (Render · Docker · signing-service/)
```

---

## 1. Crear el Blueprint

1. Render Dashboard → **New → Blueprint**.
2. Elegí el repo `ma74ni/facturador-sri`, branch `dev`.
3. Render lee `render.yaml` y propone **2 servicios**:
   - `facturador-core-staging` (Node, plan starter)
   - `facturador-signing-staging` (Docker, plan starter)
4. Antes de aplicar, Render pide las variables marcadas `sync: false`.

### Secrets de `facturador-core-staging` (copiar del servicio viejo)

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Neon — connection string **POOLED** (`...-pooler...?sslmode=require&pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Neon — connection string **DIRECTA** (sin `-pooler`). La usa `migrate deploy`. |
| `JWT_SECRET` | del servicio viejo (o generá uno nuevo de 32+ chars; invalida sesiones existentes) |
| `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` | del servicio viejo |
| `MAILJET_FROM_EMAIL` / `MAILJET_FROM_NAME` | ej. `facturacion@siete8.com` / `Facturador SRI Staging` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | del servicio viejo |

Las no-secret (`NODE_ENV`, `JWT_EXPIRATION`, `FRONTEND_URL`, `SIGNING_SERVICE_URL`,
`SRI_*_URL_*`) ya van fijas en `render.yaml`.

`facturador-signing-staging` no lleva secrets (`SPRING_PROFILES_ACTIVE` y
`JAVA_OPTS` van en el yaml).

5. **Apply**. Render buildea los dos. El de Java tarda varios minutos la primera
   vez (build Maven multi-stage).

---

## 2. Verificar

```bash
# Signing service
curl https://facturador-signing-staging.onrender.com/api/v1/signature/health
# -> {"status":"UP",...} (o similar)

# Backend
curl https://facturador-core-staging.onrender.com/api/docs   # 200
```

En los logs de `facturador-core-staging` al arrancar debe verse:
```
🔗 Microservicio de firma configurado en: https://facturador-signing-staging.onrender.com
📊 Applying Prisma migrations...   ->  No pending migrations to apply.
```

> **Nombres**: si Render cambia el nombre del signing service (colisión global),
> actualizá `SIGNING_SERVICE_URL` en `facturador-core-staging` con la URL real.

---

## 3. Prueba de firma

Con el login del POS, crear una factura (`POST /invoices`) y mirar `sriStatus`
en la respuesta:

- `PENDING` → **se firmó** ✅ → seguir con `POST /invoices/:id/send-to-sri`
- `DRAFT` + `warnings` → la firma falló → ver logs de `facturador-signing-staging`
  (OOM del JVM → bajar `-Xmx`; error de certificado → revisar `.p12` / password)

---

## 4. Apuntar el frontend a la URL nueva

En **Netlify → Site settings → Environment variables**:

```
NEXT_PUBLIC_API_URL = https://facturador-core-staging.onrender.com/api/v1
```

Luego **Trigger deploy → Clear cache and deploy site** (es build-time).

---

## 5. Limpiar

Una vez que el nuevo stack responde y el frontend apunta ahí:

1. En la **cuenta vieja** de Render: borrar el servicio `facturador-api-staging`.
2. Confirmar que ya nada usa `https://facturador-api-staging.onrender.com`.

---

## Notas

- **Plan starter ($7)**: 512 MB / 0.5 CPU, sin spin-down. El signing-service (Java)
  va justo de RAM; `JAVA_OPTS` está acotado a `-Xmx256m`. Si hay OOM en los logs,
  bajar a `-Xmx192m` o subir el plan.
- El timeout del cliente de firma en `digital-signature.service.ts` es 90 s
  (cubre el warm-up de la JVM tras un deploy).
- `render.yaml` vive en la raíz; el viejo `packages/facturacion-core/render.yaml`
  se eliminó para no tener dos definiciones.
- Migraciones: `render-start.sh` corre `prisma migrate deploy` usando `DIRECT_URL`
  (conexión directa, no el pooler) para no filtrar el advisory lock.
