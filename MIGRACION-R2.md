# Migración de Almacenamiento Local a Cloudflare R2

## Resumen

Se ha migrado completamente el sistema de almacenamiento del facturador SRI desde almacenamiento local en disco a **Cloudflare R2**. Esto proporciona:

- ✅ Almacenamiento escalable en la nube
- ✅ Alta disponibilidad y redundancia
- ✅ Acceso global con baja latencia
- ✅ Reducción de costos (compatible con S3, sin costos de egress)
- ✅ Mejor arquitectura para despliegues en contenedores

## Archivos Migrados a R2

Todos los archivos del sistema ahora se almacenan en R2:

1. **Certificados digitales (.p12)** - `certificates/{companyId}/{filename}.p12`
2. **Logos de empresas** - `logos/{companyId}/{filename}.{ext}`
3. **XMLs sin firmar** - `xml/{companyId}/{accessKey}.xml`
4. **XMLs firmados** - `xml-signed/{companyId}/{accessKey}_signed.xml`
5. **PDFs RIDE** - `ride/{companyId}/{accessKey}.pdf`

## Configuración Requerida

### 1. Variables de Entorno

Agregar las siguientes variables al archivo `.env`:

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=facturador-sri
```

### 2. Obtener Credenciales de Cloudflare R2

1. Iniciar sesión en [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Ir a **R2 Object Storage**
3. Crear un bucket llamado `facturador-sri` (o el nombre que prefieras)
4. Ir a **Manage R2 API Tokens**
5. Crear un nuevo API Token con permisos de **Admin Read & Write**
6. Copiar:
   - **Account ID** → `R2_ACCOUNT_ID`
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

## Cambios en la Arquitectura

### Servicios Modificados

#### 1. **R2StorageService** (Nuevo)
- **Ubicación:** `src/shared/storage/r2-storage.service.ts`
- **Funcionalidad:** Servicio centralizado para todas las operaciones con R2
- **Métodos principales:**
  - `uploadFile()` - Subir archivo genérico
  - `downloadFile()` - Descargar archivo genérico
  - `deleteFile()` - Eliminar archivo
  - `uploadCertificate()` - Subir certificado .p12
  - `uploadLogo()` - Subir logo de empresa
  - `uploadXml()` - Subir XML (firmado o sin firmar)
  - `uploadRide()` - Subir PDF RIDE
  - `getSignedDownloadUrl()` - Generar URL firmada temporal

#### 2. **CompaniesService**
- **Cambios:**
  - Subida de certificados a R2 en lugar de filesystem local
  - Subida de logos a R2 en lugar de filesystem local
  - Eliminación usa R2 en lugar de filesystem local

#### 3. **XmlStorageService** (Facturas)
- **Cambios:**
  - `saveXml()` ahora sube a R2
  - `saveSignedXml()` ahora sube a R2
  - Agregado parámetro `companyId` para organizar por empresa

#### 4. **CreditNoteXmlStorageService**
- **Cambios:**
  - `saveXml()` ahora sube a R2
  - `saveSignedXml()` ahora sube a R2

#### 5. **DigitalSignatureService**
- **Cambios:**
  - Lee certificados desde R2 en lugar de filesystem
  - Método `signXml()` ahora recibe objeto `company` con la ruta R2

#### 6. **RideGeneratorService**
- **Cambios:**
  - Genera PDF en memoria (buffer)
  - Sube PDF a R2 en lugar de guardarlo localmente
  - Descarga logos desde R2 para incluirlos en el PDF

#### 7. **InvoicesController**
- **Cambios:**
  - Endpoint `/invoices/:id/xml` descarga desde R2
  - Endpoint `/invoices/:id/ride/download` descarga desde R2

#### 8. **CompaniesController**
- **Cambios:**
  - Endpoint `/companies/logo` descarga desde R2

### Nuevos Módulos

#### **SharedModule**
- **Ubicación:** `src/shared/shared.module.ts`
- **Propósito:** Módulo global que exporta servicios compartidos
- **Exports:**
  - `PrismaService`
  - `R2StorageService`
  - `EmailService`

## Estructura de Archivos en R2

```
facturador-sri/ (bucket)
├── certificates/
│   └── {companyId}/
│       └── {companyId}_{timestamp}.p12
├── logos/
│   └── {companyId}/
│       └── {companyId}.{png|jpg|jpeg}
├── xml/
│   └── {companyId}/
│       └── {accessKey}.xml
├── xml-signed/
│   └── {companyId}/
│       └── {accessKey}_signed.xml
└── ride/
    └── {companyId}/
        └── {accessKey}.pdf
```

## Migración de Datos Existentes

Si tienes archivos existentes en el almacenamiento local, necesitarás migrarlos manualmente a R2:

### Opción 1: Usar AWS CLI (compatible con R2)

```bash
# Configurar AWS CLI con credenciales de R2
aws configure --profile r2

# Sincronizar archivos locales a R2
aws s3 sync ./storage/certificates s3://facturador-sri/certificates --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com --profile r2
aws s3 sync ./storage/logos s3://facturador-sri/logos --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com --profile r2
aws s3 sync ./storage/xml s3://facturador-sri/xml --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com --profile r2
aws s3 sync ./storage/xml-signed s3://facturador-sri/xml-signed --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com --profile r2
aws s3 sync ./storage/ride s3://facturador-sri/ride --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com --profile r2
```

### Opción 2: Usar Rclone

```bash
# Configurar rclone para R2
rclone config

# Sincronizar
rclone sync ./storage/certificates r2:facturador-sri/certificates
rclone sync ./storage/logos r2:facturador-sri/logos
rclone sync ./storage/xml r2:facturador-sri/xml
rclone sync ./storage/xml-signed r2:facturador-sri/xml-signed
rclone sync ./storage/ride r2:facturador-sri/ride
```

### Opción 3: Script de Migración (Recomendado)

Crear un script de migración que:
1. Lee los registros de la base de datos
2. Para cada archivo referenciado:
   - Lee el archivo local
   - Lo sube a R2
   - Actualiza la ruta en la base de datos

Ejemplo:

```typescript
import { PrismaClient } from '@prisma/client';
import { R2StorageService } from './src/shared/storage/r2-storage.service';
import { readFile } from 'fs/promises';

const prisma = new PrismaClient();
const r2Storage = new R2StorageService();

async function migrateCompanyCertificates() {
  const companies = await prisma.company.findMany({
    where: { hasCertificate: true },
  });

  for (const company of companies) {
    if (company.certificatePath && company.certificatePath.includes('storage/')) {
      const buffer = await readFile(company.certificatePath);
      const filename = company.certificatePath.split('/').pop();
      const r2Key = await r2Storage.uploadCertificate(company.id, buffer, filename);

      await prisma.company.update({
        where: { id: company.id },
        data: { certificatePath: r2Key },
      });

      console.log(`Migrated certificate for company ${company.id}`);
    }
  }
}

// Similar para logos, XMLs, y PDFs...
```

## Actualización de Base de Datos

Los campos que almacenan rutas de archivos ahora contienen **keys de R2** en lugar de rutas locales:

**Antes:**
```
certificatePath: "/app/storage/certificates/company123_1234567890.p12"
logoPath: "/app/storage/logos/company123.png"
xmlPath: "/app/storage/xml/0123456789...xml"
```

**Después:**
```
certificatePath: "certificates/company123/company123_1234567890.p12"
logoPath: "logos/company123/company123.png"
xmlPath: "xml/company123/0123456789...xml"
```

## Ventajas de la Migración

### 1. **Escalabilidad**
- No hay límites de almacenamiento
- Crece automáticamente según demanda

### 2. **Disponibilidad**
- Alta disponibilidad garantizada por Cloudflare
- Redundancia automática

### 3. **Rendimiento**
- Red global de Cloudflare
- Baja latencia desde cualquier ubicación

### 4. **Costos**
- Sin cargos por transferencia de datos (egress)
- Precios competitivos de almacenamiento
- Compatible con API S3 (fácil migración futura si es necesario)

### 5. **DevOps**
- Despliegues stateless (contenedores no necesitan volúmenes persistentes)
- Facilita horizontal scaling
- Ideal para Kubernetes, Docker Swarm, etc.

### 6. **Seguridad**
- Archivos aislados por empresa
- Control de acceso mediante IAM
- Cifrado en reposo y en tránsito

## Rollback (en caso de problemas)

Si necesitas volver al almacenamiento local temporalmente:

1. Revertir los commits de migración
2. Restaurar archivos desde R2 al filesystem local
3. Actualizar las rutas en la base de datos

Sin embargo, se recomienda **resolver los problemas en R2** en lugar de hacer rollback, ya que el almacenamiento en la nube es la solución a largo plazo.

## Pruebas Recomendadas

Después de la migración, probar:

1. ✅ **Subida de certificado** - Verificar que se sube correctamente a R2
2. ✅ **Subida de logo** - Verificar visualización en el sistema
3. ✅ **Creación de factura** - Verificar generación y almacenamiento de XML
4. ✅ **Firma digital** - Verificar que el certificado se lee correctamente desde R2
5. ✅ **Generación de RIDE** - Verificar que el logo se incluye en el PDF
6. ✅ **Descarga de XML** - Verificar endpoint de descarga
7. ✅ **Descarga de RIDE** - Verificar endpoint de descarga
8. ✅ **Envío de email** - Verificar que los adjuntos se descargan correctamente de R2

## Soporte

Para problemas o preguntas sobre la migración a R2, consultar:
- Documentación de Cloudflare R2: https://developers.cloudflare.com/r2/
- AWS SDK para JavaScript v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/

---

**Fecha de migración:** 2025-10-21
**Versión:** 1.1.0
