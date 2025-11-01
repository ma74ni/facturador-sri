# XML Signature Service

Microservicio Java Spring Boot para firma digital de documentos XML con XAdES-BES (XML Advanced Electronic Signatures - Basic Electronic Signature). Utilizado por el Sistema de Facturación Electrónica SRI Ecuador para firmar comprobantes electrónicos antes de su envío al SRI.

## Tecnologías

- **Framework**: Spring Boot 3.2.0
- **Java**: 17 (LTS)
- **Build Tool**: Maven 3.9
- **Firma Digital**: Apache Santuario XMLSec 3.0.3
- **Certificados**: Bouncy Castle 1.77
- **Contenedores**: Docker + Docker Compose

## Características

- ✅ Firma XML con estándar XAdES-BES
- ✅ Soporte para certificados PKCS#12 (.p12)
- ✅ API REST con validación de datos
- ✅ Health check endpoint
- ✅ Información de certificado
- ✅ Logs estructurados
- ✅ CORS configurado
- ✅ Compresión de respuestas
- ✅ Docker ready con multi-stage build
- ✅ Usuario no privilegiado en contenedor

## Requisitos Previos

### Desarrollo Local
- Java 17 o superior
- Maven 3.6+
- Certificado digital PKCS#12 (.p12) para pruebas

### Producción
- Docker 20.10+
- Docker Compose 2.0+

## Instalación y Configuración

### Desarrollo Local

```bash
# Clonar o navegar al directorio
cd signing-service

# Compilar el proyecto
./mvnw clean package

# Ejecutar la aplicación
./mvnw spring-boot:run

# O ejecutar el JAR directamente
java -jar target/xml-signature-service-1.0.0.jar
```

La aplicación estará disponible en: `http://localhost:8081`

### Usando Docker

```bash
# Construir la imagen
docker build -t xml-signature-service .

# Ejecutar el contenedor
docker run -d -p 18081:8081 --name signing-service xml-signature-service
```

### Usando Docker Compose (Recomendado)

```bash
# Iniciar el servicio
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener el servicio
docker-compose down
```

El servicio estará disponible en: `http://localhost:18081`

## Configuración

### application.yml

El servicio se configura mediante el archivo `src/main/resources/application.yml`:

```yaml
server:
  port: 8081                    # Puerto interno del servicio

spring:
  servlet:
    multipart:
      max-file-size: 10MB      # Tamaño máximo de archivos
      max-request-size: 10MB   # Tamaño máximo de request

logging:
  level:
    root: INFO
    com.facturadorsri: DEBUG
  file:
    name: logs/signing-service.log

cors:
  allowed-origins: "*"         # Orígenes permitidos (ajustar en producción)
  allowed-methods: "GET,POST,PUT,DELETE,OPTIONS"
```

### Variables de Entorno (Docker)

```bash
# Perfil de Spring
SPRING_PROFILES_ACTIVE=production

# Opciones de JVM
JAVA_OPTS=-Xmx512m -Xms256m
```

## API Endpoints

### Base URL

- **Local**: `http://localhost:8081/api/v1/signature`
- **Docker**: `http://localhost:18081/api/v1/signature`

### POST /sign - Firmar XML

Firma un documento XML con un certificado digital.

**Request:**
```json
{
  "xmlContent": "<factura>...</factura>",
  "certificateBase64": "MIIKpAIBAz...",
  "certificatePassword": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "signedXml": "<factura><Signature>...</Signature></factura>",
  "certificateInfo": {
    "subject": "CN=MI EMPRESA S.A., O=MI EMPRESA, C=EC",
    "issuer": "CN=AC BANCO CENTRAL DEL ECUADOR, O=BANCO CENTRAL...",
    "serialNumber": "1234567890",
    "validFrom": "2023-01-01T00:00:00",
    "validTo": "2025-12-31T23:59:59"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "errorMessage": "Certificado inválido o contraseña incorrecta"
}
```

**Códigos de Estado:**
- `200 OK` - Firma exitosa
- `400 Bad Request` - Error de validación o firma
- `500 Internal Server Error` - Error interno del servidor

### POST /certificate/info - Información del Certificado

Obtiene información de un certificado sin firmar ningún documento.

**Request:**
```json
{
  "certificateBase64": "MIIKpAIBAz...",
  "password": "password123"
}
```

**Response:**
```json
{
  "subject": "CN=MI EMPRESA S.A., O=MI EMPRESA, C=EC",
  "issuer": "CN=AC BANCO CENTRAL DEL ECUADOR",
  "serialNumber": "1234567890",
  "validFrom": "2023-01-01T00:00:00",
  "validTo": "2025-12-31T23:59:59"
}
```

### GET /health - Health Check

Verifica que el servicio esté funcionando.

**Response:**
```json
{
  "status": "OK",
  "message": "XML Signature Service is running"
}
```

## Estructura del Proyecto

```
signing-service/
├── src/
│   ├── main/
│   │   ├── java/com/facturadorsri/signing_service/
│   │   │   ├── config/           # Configuración (CORS, etc.)
│   │   │   ├── controller/       # Controladores REST
│   │   │   ├── dto/              # DTOs (Request/Response)
│   │   │   ├── exception/        # Excepciones personalizadas
│   │   │   ├── service/          # Lógica de firma digital
│   │   │   └── SigningServiceApplication.java
│   │   └── resources/
│   │       ├── application.yml   # Configuración principal
│   │       └── application.properties
│   └── test/                     # Tests unitarios
├── logs/                         # Logs de la aplicación
├── Dockerfile                    # Imagen Docker multi-stage
├── docker-compose.yml            # Orquestación Docker
├── pom.xml                       # Dependencias Maven
└── README.md                     # Este archivo
```

## Dependencias Principales

| Dependencia | Versión | Propósito |
|------------|---------|-----------|
| Spring Boot | 3.2.0 | Framework web |
| Apache Santuario XMLSec | 3.0.3 | Firma digital XML |
| Bouncy Castle | 1.77 | Manejo de certificados PKCS#12 |
| Jakarta Validation | 3.0.2 | Validación de DTOs |
| Lombok | Latest | Reducir boilerplate |

## Funcionamiento de la Firma Digital

### Proceso de Firma

1. **Recepción**: El backend envía XML + certificado Base64 + contraseña
2. **Decodificación**: Se decodifica el certificado PKCS#12 desde Base64
3. **Carga de Certificado**: Se carga el certificado y clave privada con Bouncy Castle
4. **Firma XML**: Se firma el XML usando Apache Santuario (XAdES-BES)
5. **Respuesta**: Se retorna el XML firmado + información del certificado

### Formato XAdES-BES

XAdES-BES (XML Advanced Electronic Signatures - Basic Electronic Signature) es un estándar europeo para firmas digitales XML que incluye:

- Firma digital del documento
- Información del certificado (Subject, Issuer, Serial Number)
- Timestamp de la firma
- Algoritmos de firma y hash

El SRI Ecuador requiere este formato para la validación de comprobantes electrónicos.

### Certificados Soportados

- **Formato**: PKCS#12 (.p12, .pfx)
- **Autoridades**: Banco Central del Ecuador, Security Data, ANF, etc.
- **Codificación**: Base64 para transferencia HTTP

## Comandos Útiles

### Maven

```bash
# Compilar sin tests
./mvnw clean package -DskipTests

# Ejecutar tests
./mvnw test

# Limpiar build
./mvnw clean

# Ver dependencias
./mvnw dependency:tree

# Actualizar dependencias
./mvnw versions:display-dependency-updates
```

### Docker

```bash
# Construir imagen
docker build -t xml-signature-service:latest .

# Ejecutar contenedor
docker run -d \
  -p 18081:8081 \
  -v $(pwd)/logs:/app/logs \
  --name signing-service \
  xml-signature-service:latest

# Ver logs
docker logs -f signing-service

# Detener contenedor
docker stop signing-service

# Eliminar contenedor
docker rm signing-service

# Ver estadísticas
docker stats signing-service
```

### Docker Compose

```bash
# Iniciar en modo detached
docker-compose up -d

# Iniciar con rebuild
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Reiniciar servicio
docker-compose restart
```

## Testing

### Test Manual con cURL

```bash
# Health check
curl http://localhost:18081/api/v1/signature/health

# Firmar XML (requiere certificado válido)
curl -X POST http://localhost:18081/api/v1/signature/sign \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<factura><infoTributaria>...</infoTributaria></factura>",
    "certificateBase64": "MIIKpAIBAz...",
    "certificatePassword": "tu_password"
  }'

# Información de certificado
curl -X POST http://localhost:18081/api/v1/signature/certificate/info \
  -H "Content-Type: application/json" \
  -d '{
    "certificateBase64": "MIIKpAIBAz...",
    "password": "tu_password"
  }'
```

### Tests Automatizados

```bash
# Ejecutar todos los tests
./mvnw test

# Ejecutar tests con cobertura
./mvnw test jacoco:report

# Ver reporte de cobertura
open target/site/jacoco/index.html
```

## Logs

### Ubicación de Logs

- **Local**: `logs/signing-service.log`
- **Docker**: Montado en volumen `./logs:/app/logs`

### Niveles de Log

```yaml
logging:
  level:
    root: INFO                          # Logs generales
    com.facturadorsri: DEBUG           # Logs de la aplicación
    org.apache.xml.security: DEBUG     # Logs de firma XML
```

### Ver Logs

```bash
# En desarrollo local
tail -f logs/signing-service.log

# En Docker
docker-compose logs -f xml-signature-service

# Filtrar errores
docker-compose logs | grep ERROR
```

## Seguridad

### Buenas Prácticas Implementadas

✅ **Usuario no privilegiado**: El contenedor ejecuta con usuario `appuser` (no root)
✅ **Multi-stage build**: Imagen final mínima sin herramientas de build
✅ **Validación de entrada**: Jakarta Validation en todos los endpoints
✅ **Logs sin información sensible**: Passwords no se registran en logs
✅ **Health check**: Endpoint para monitoreo de salud
✅ **Compresión**: Respuestas comprimidas para reducir ancho de banda

### Recomendaciones para Producción

⚠️ **CORS**: Configurar orígenes específicos en lugar de `*`
```yaml
cors:
  allowed-origins: "https://midominio.com,https://api.midominio.com"
```

⚠️ **HTTPS**: Usar reverse proxy (Nginx, Traefik) con certificado SSL

⚠️ **Límite de requests**: Implementar rate limiting

⚠️ **Certificados**: Nunca almacenar certificados en el código o logs

⚠️ **Monitoreo**: Configurar alertas para fallos de firma

## Troubleshooting

### Problemas Comunes

**Error: "Certificado inválido o contraseña incorrecta"**
- Verificar que el certificado esté en formato PKCS#12
- Confirmar que la contraseña sea correcta
- Asegurar que el certificado esté en Base64

**Error: "Java heap space"**
- Aumentar memoria JVM: `JAVA_OPTS=-Xmx1g -Xms512m`

**Error: "Puerto 18081 ya en uso"**
```bash
# Encontrar proceso usando el puerto
lsof -i :18081

# Detener el proceso o cambiar puerto en docker-compose.yml
```

**Servicio no inicia en Docker**
```bash
# Ver logs completos
docker-compose logs xml-signature-service

# Verificar health check
docker inspect xml-signature-service | grep Health
```

## Integración con Backend NestJS

El backend NestJS llama a este servicio mediante HTTP:

```typescript
// packages/facturacion-core/src/modules/invoices/infrastructure/xml/digital-signature.service.ts

async signXml(xmlContent: string, certificateBase64: string, password: string) {
  const response = await axios.post('http://localhost:18081/api/v1/signature/sign', {
    xmlContent,
    certificateBase64,
    certificatePassword: password
  });

  return response.data.signedXml;
}
```

**Configuración en Backend:**
```env
# .env del backend
SIGNING_SERVICE_URL=http://localhost:18081
```

## Arquitectura del Sistema

```
┌─────────────────┐
│  Frontend       │
│  (Next.js)      │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Backend API    │
│  (NestJS)       │
└────────┬────────┘
         │ HTTP POST /api/v1/signature/sign
         ▼
┌─────────────────┐
│  Signing        │
│  Service        │  ◄── Servicio actual
│  (Java/Spring)  │
└─────────────────┘
         │
         │ Firma con XAdES-BES
         ▼
┌─────────────────┐
│  SRI Web        │
│  Services       │
│  (SOAP)         │
└─────────────────┘
```

## Performance

### Métricas Típicas

- **Tiempo de firma**: 100-300ms por documento
- **Memoria**: 256MB-512MB (configurable)
- **Throughput**: ~50-100 firmas/segundo (depende de hardware)

### Optimización

```yaml
# application.yml - Configuración optimizada
server:
  tomcat:
    threads:
      max: 200              # Threads máximos
      min-spare: 10         # Threads mínimos
  compression:
    enabled: true           # Comprimir respuestas
```

## Monitoreo

### Health Check

```bash
# Verificar salud del servicio
curl http://localhost:18081/api/v1/signature/health

# Con Docker healthcheck
docker inspect xml-signature-service --format='{{.State.Health.Status}}'
```

### Métricas

Para producción, considerar integrar:
- Spring Boot Actuator
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)

## Licencia

Este proyecto es parte del Sistema de Facturación Electrónica SRI Ecuador.

## Soporte

Para problemas relacionados con:
- **Firma digital**: Revisar logs en `logs/signing-service.log`
- **Certificados**: Contactar a la autoridad certificadora (Banco Central, Security Data, etc.)
- **Integración**: Revisar configuración de `SIGNING_SERVICE_URL` en backend

## Documentación Adicional

- [Apache Santuario XMLSec](https://santuario.apache.org/)
- [Bouncy Castle](https://www.bouncycastle.org/)
- [XAdES Specification](https://www.etsi.org/deliver/etsi_ts/101900_101999/101903/)
- [SRI Ecuador - Facturación Electrónica](https://www.sri.gob.ec/)
