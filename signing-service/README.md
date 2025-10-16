# Signing Service

Microservicio Java (Spring Boot) encargado de firmar comprobantes electrónicos siguiendo las directrices del SRI.

## Requisitos previos

* Java 17
* Maven 3.9+
* Certificado digital del SRI en formato PKCS#12 (`.p12`)

## Configuración

Defina la ruta del certificado, alias y contraseña en `src/main/resources/application.yml` o por variables de entorno:

```properties
sri.signing.keystore-path=/ruta/al/certificado.p12
sri.signing.keystore-password=claveDelP12
sri.signing.certificate-alias=aliasEnElCertificado
sri.signing.policy-identifier=https://facturaelectronica.sri.gob.ec/firma/v2/politicafirma.xml
sri.signing.policy-digest-algorithm=http://www.w3.org/2000/09/xmldsig#sha1
sri.signing.policy-digest-value=Ohixl6upD6av8N7pEvDABhEL6hM=
```

## Ejecución local

```bash
mvn spring-boot:run
```

El servicio quedará disponible en `http://localhost:8081/api/sign`.

## Uso del endpoint

Enviar una solicitud `POST` con `Content-Type: application/json`:

```json
{
  "xml": "<factura Id=\"comprobante\">...</factura>"
}
```

La respuesta contendrá el XML firmado:

```json
{
  "signedXml": "<factura Id=\"comprobante\">...<ds:Signature>...</ds:Signature></factura>"
}
```

En caso de error se devolverá un mensaje descriptivo y el código HTTP apropiado (`400`, `422` o `500`).
