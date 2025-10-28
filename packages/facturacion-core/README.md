# Facturador SRI – Backend

## Configuración relevante

- `SIGNING_SERVICE_URL`: URL base del microservicio Java encargado de firmar XMLs (por defecto `http://localhost:8081`). Debe apuntar al host/puerto donde se expone el endpoint `/api/sign`.

## Flujo de firma

1. El backend genera el XML de la factura.
2. El servicio `DigitalSignatureService` envía el XML al microservicio (`POST /api/sign`).
3. El microservicio devuelve el XML firmado (XAdES-BES) y se almacena en disco para su posterior envío al SRI.
