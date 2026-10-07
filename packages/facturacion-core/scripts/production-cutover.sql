-- Paso a PRODUCCIÓN de una empresa que estuvo emitiendo en el ambiente de
-- pruebas del SRI. Correr contra la base de producción, en la ventana de
-- cambio, con el POS detenido (ver PRODUCCION.md). Cambia :'ruc' por el RUC.
--
--   psql "$PROD_DIRECT_URL" -v ruc=1790000000001 -f scripts/production-cutover.sql
--
-- Antes: respaldo (pg_dump) y la clave del certificado real ya cargada desde
-- el facturador (queda cifrada).

begin;

-- 1. Las facturas emitidas en pruebas (dígito 24 de la clave de acceso = 1)
--    quedan marcadas: no son válidas ante el SRI. No se borran porque el POS
--    y la cobranza las referencian.
update invoices i
set "cancelReason" = coalesce(i."cancelReason", 'Emitida en el ambiente de pruebas del SRI, antes de producción'),
    "cancelledAt" = coalesce(i."cancelledAt", now())
from companies c
where c.id = i."companyId"
  and c.ruc = :'ruc'
  and substring(i."accessKey" from 24 for 1) = '1';

update credit_notes n
set "cancelReason" = coalesce(n."cancelReason", 'Emitida en el ambiente de pruebas del SRI, antes de producción'),
    "cancelledAt" = coalesce(n."cancelledAt", now())
from companies c
where c.id = n."companyId"
  and c.ruc = :'ruc'
  and substring(n."accessKey" from 24 for 1) = '1';

-- 2. La numeración real arranca en 001-001-000000001 en cada punto.
update emission_points p
set "invoiceSequence" = 1,
    "creditNoteSequence" = 1
from establishments e, companies c
where e.id = p."establishmentId"
  and c.id = e."companyId"
  and c.ruc = :'ruc';

-- 3. Ambiente de PRODUCCIÓN.
update companies set environment = 'PRODUCTION' where ruc = :'ruc';

commit;

-- Verificación
select ruc, environment, "hasCertificate", "certificateExpiry" from companies where ruc = :'ruc';
select e.code as establecimiento, p.code as punto, p."invoiceSequence", p."creditNoteSequence"
from emission_points p join establishments e on e.id = p."establishmentId"
join companies c on c.id = e."companyId" where c.ruc = :'ruc';
