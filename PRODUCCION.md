# Paso a producción del facturador y del POS de Lattia

El staging actual pasa a ser **producción** (conserva productos, clientes,
usuarios y las ventas del POS). Se crea un **staging nuevo y barato**: ramas
de Neon e instancias Free de Render. Afecta a dos repos:

- `facturador-sri`: rama `feat/production-cutover`.
- `new-lattia-pos`: rama `chore/production-split`.

| | Producción | Staging |
| --- | --- | --- |
| Rama de git | `main` | `dev` |
| Render | `facturador-core`, `facturador-signing`, `lattia-pos-api` (Starter) | `facturador-core-dev`, `facturador-signing-dev`, `lattia-pos-api-dev` (Free) |
| Neon | Proyectos actuales (rama principal) | Rama `staging` de cada proyecto, limpiada |
| R2 | Buckets actuales (`facturador-sri-staging`, `new-lattia-pos-staging`) | Buckets nuevos `facturador-sri-dev`, `new-lattia-pos-dev` |
| Web del facturador | `app.facturador.siete8.com` | `dev--facturador-siete8.netlify.app` |
| API del facturador | `api.facturador.siete8.com` | `facturador-core-dev.onrender.com` |
| POS | `pos.heladerialattia.com` | `dev--lattia-pos.netlify.app` |
| API del POS | `api-pos.heladerialattia.com` | `lattia-pos-api-dev.onrender.com` |

Los buckets de producción conservan su nombre `-staging`: R2 no permite
renombrar y ya tienen los certificados y comprobantes reales.

Los sitios de Netlify (`facturador-siete8` y `lattia-pos`) están en el mismo
equipo que el DNS de `siete8.com` y `heladerialattia.com`: Netlify no deja
asignar a un sitio un dominio cuya zona DNS está en otro equipo. Los sitios
anteriores (`boisterous-griffin-ebe677` y `lattia-pos-web-staging`, en otro
equipo) se borran al terminar (C).

## A. Antes de la ventana (sin cortar el servicio)

1. **Llave de cifrado de certificados.** Generar una y guardarla en el gestor
   de contraseñas:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   Cargarla como `CERTIFICATE_ENCRYPTION_KEY` en el servicio actual
   `facturador-core-staging` (Render > Environment). Sin ella, con el código
   nuevo, subir un certificado falla a propósito.
2. **Desplegar el cifrado** en un PR propio a `dev` (el servicio actual
   despliega desde `dev`), SOLO con estos archivos: `src/shared/crypto/*`,
   `scripts/encrypt-certificate-passwords.ts`, `companies.service.ts` y
   `digital-signature.service.ts`. El `render.yaml` nuevo NO va en este PR:
   el Blueprint sigue la rama `dev` y se sincronizaría solo, creando
   servicios de producción duplicados antes de renombrar los actuales (B2).
3. **Cifrar las claves ya guardadas:**
   `cd packages/facturacion-core && DATABASE_URL=<DIRECT_URL actual> CERTIFICATE_ENCRYPTION_KEY=<llave> npx ts-node scripts/encrypt-certificate-passwords.ts`
4. **Probar** una factura en el ambiente de pruebas: debe firmarse igual.
5. **Ramas `main`.** Crear `main` desde `dev` en el facturador (en el POS
   `main` ya existe) y una rama `dev` desde `main` en el POS.
6. **Dominios en Netlify DNS** (los dos dominios ya están ahí):
   - Render > `facturador-core-staging` > Settings > Custom Domains:
     `api.facturador.siete8.com` (Render indica el CNAME).
   - Render > `lattia-pos-api` > Custom Domains: `api-pos.heladerialattia.com`.
   - Netlify > `facturador-siete8` > Domain management:
     `app.facturador.siete8.com` (Netlify crea el registro; no agregar un
     CNAME a mano).
   - Netlify > `lattia-pos` > Domain management: `pos.heladerialattia.com`.
   - En siete8.com solo se agregan esos subdominios; los registros de la
     raíz (correo) no se tocan.
   - `CORS_ORIGIN` de `lattia-pos-api` incluye `https://pos.heladerialattia.com`
     y `https://lattia-pos.netlify.app`.
   Esperar a que los cuatro respondan con HTTPS.

## B. Ventana de cambio (con la heladería cerrada)

0. **Cajas al día:** en cada caja, en el POS anterior
   (`lattia-pos-web-staging.netlify.app`), no debe quedar ninguna venta sin
   sincronizar: las ventas sin conexión viven en el navegador y quedan atadas
   a esa URL.
1. **Respaldos** de los dos proyectos de Neon:
   `pg_dump "<DIRECT_URL>" -Fc -f facturador-AAAA-MM-DD.dump` (y el del POS).
2. **Renombrar en Render** (Settings > Name), sin tocar nada más:
   `facturador-core-staging` → `facturador-core` y
   `facturador-signing-staging` → `facturador-signing`.
   La URL `*.onrender.com` no cambia; por eso usamos los dominios propios.
3. **Ramas de Neon para staging:** en cada proyecto, Branches > Create
   branch `staging` desde la principal. Correr la limpieza contra la RAMA
   (revisar el host antes):
   - `psql "<URL rama staging facturador>" -f packages/facturacion-core/scripts/staging-scrub.sql`
   - `psql "<URL rama staging POS>" -f apps/pos-api/scripts/staging-scrub.sql`
   Las verificaciones del final deben dar 0.
4. **Buckets R2** nuevos: `facturador-sri-dev` y `new-lattia-pos-dev`.
5. **Fusionar los cambios de infraestructura** (`render.yaml`, `netlify.toml`,
   scripts SQL y esta guía) en `main` del facturador y del POS. En Render >
   Blueprints, cambiar la rama del Blueprint del facturador a `main` y
   sincronizar los dos. Se crean los tres servicios
   `-dev`; cargar sus secretos (`sync: false`), con un `JWT_SECRET`, una
   `CERTIFICATE_ENCRYPTION_KEY` y una `CUSTOMER_PII_ENCRYPTION_KEY` distintas
   de producción.
   - `SIGNING_SERVICE_URL` de producción = URL onrender de `facturador-signing`.
   - En los servicios de producción, cambiar la rama a `main` si el
     Blueprint no lo hizo.
6. **Netlify:** en los dos sitios, rama de producción `main`, branch deploys
   para `dev`. Borrar las variables `NEXT_PUBLIC_API_URL` y
   `VITE_API_BASE_URL` de la interfaz: ahora viven en cada `netlify.toml`.
7. **POS:** `psql "<URL producción POS>" -f apps/pos-api/scripts/production-cutover.sql`
   (cierra las facturas pendientes de pruebas para que el cron no las mande al
   SRI real).
8. **Empresa aprobada y certificado real:** la empresa de la heladería en
   estado APROBADA (hoy sigue PENDIENTE) y su certificado real cargado desde
   el facturador (queda cifrado).
9. **Facturador:** `psql "<URL producción facturador>" -v ruc=<RUC de la heladería> -f packages/facturacion-core/scripts/production-cutover.sql`
   (marca las facturas de pruebas, reinicia la numeración en 1 y pasa la
   empresa a PRODUCCIÓN).
10. **Correo:** en Render, `MAILJET_FROM_NAME` de producción sin "Staging".
11. **Cajas:** en cada PC de caja, abrir `https://pos.heladerialattia.com`
    (marcador o app instalada) y agregar ese origen a `allowedOrigins` del
    `print-bridge.config.json` instalado (ver
    `ops/pos-terminal/print-bridge/README.md` del POS); reiniciar el puente.
    Sin eso el ticket sale por el diálogo de impresión.
12. **Prueba real:** una venta pequeña en el POS con factura: debe quedar
    AUTORIZADA en el SRI con el secuencial 000000001 del punto que factura
    (hoy 002-020), imprimir el ticket directo y llegar el RIDE por correo.

## C. Después

- Borrar los sitios anteriores de Netlify (`boisterous-griffin-ebe677` y
  `lattia-pos-web-staging`) y revisar si el plan pagado de ese equipo sigue
  haciendo falta.
- Limitar el CORS de `facturacion-core` (hoy `enableCors()` acepta cualquier
  origen) a sus dominios.
- Respaldo diario cifrado de las dos bases (como `backup.yml` del sitio de
  Siete8) y Sentry en el plan gratuito.
- Revisar la factura de Neon a la semana: staging debe costar centavos.
- Pendiente aparte: cifrar también `mailjetSecretKey` y `smtpPassword` de
  cada empresa con el mismo mecanismo.
