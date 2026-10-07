-- Limpieza de la base de STAGING después de crearla como rama (branch) de
-- producción en Neon. Correr SOLO contra la rama de staging, nunca contra
-- producción: revisa el host de la conexión antes de ejecutar.
--
--   psql "$STAGING_DIRECT_URL" -f scripts/staging-scrub.sql
--
-- Qué hace: ninguna empresa puede firmar ni emitir en el SRI real, y nadie
-- de verdad recibe correos desde staging.

begin;

-- 1. Todas las empresas en ambiente de PRUEBAS y sin certificado real.
update companies
set environment = 'TEST',
    "certificatePath" = null,
    "certificatePassword" = null,
    "certificateExpiry" = null,
    "hasCertificate" = false,
    -- Credenciales de correo propias de cada empresa: fuera.
    "emailProvider" = 'SYSTEM',
    "mailjetApiKey" = null,
    "mailjetSecretKey" = null,
    "mailjetFromEmail" = null,
    "mailjetFromName" = null,
    "mailjetSenderVerified" = false,
    "smtpPassword" = null;

-- 2. Los clientes finales no reciben facturas de prueba: correo de ejemplo.
update customers
set email = 'cliente+' || id || '@example.com'
where email is not null;

-- 3. Rutas a archivos del bucket de producción: el bucket de staging no las
--    tiene, así que se vacían para no confundir.
update invoices set "xmlPath" = null, "xmlSignedPath" = null, "ridePdfPath" = null;
update companies set "logoPath" = null;

commit;

-- Verificación (debe dar 0 en las tres):
select count(*) as empresas_en_produccion from companies where environment = 'PRODUCTION';
select count(*) as certificados from companies where "certificatePassword" is not null;
select count(*) as correos_reales from customers where email not like 'cliente+%@example.com';
