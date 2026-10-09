/**
 * Completa titular, entidad emisora y vigencia de los certificados ya
 * cargados, leyéndolos del propio .p12 (antes la fecha de vencimiento la
 * escribía la persona a mano, o quedaba vacía). Corre en el servicio de
 * Render, que ya tiene la base, R2 y CERTIFICATE_ENCRYPTION_KEY:
 *
 *   npx ts-node scripts/backfill-certificate-info.ts           # solo muestra
 *   npx ts-node scripts/backfill-certificate-info.ts --apply   # guarda
 *
 * Idempotente. No imprime claves ni contenido del certificado.
 */
import { PrismaClient } from '@prisma/client';
import { R2StorageService } from '../src/shared/storage/r2-storage.service';
import { openCertificatePassword } from '../src/shared/crypto/secret-cipher';
import { inspectCertificate } from '../src/modules/companies/domain/certificate-inspector';

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : '—');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  const storage = new R2StorageService();

  try {
    const companies = await prisma.company.findMany({
      where: { hasCertificate: true, certificatePath: { not: null }, certificatePassword: { not: null } },
      select: { id: true, ruc: true, certificatePath: true, certificatePassword: true, certificateExpiry: true },
      orderBy: { ruc: 'asc' },
    });

    let updated = 0;
    let failed = 0;
    for (const company of companies) {
      try {
        const file = await storage.downloadCertificate(company.certificatePath!);
        const info = inspectCertificate(file, openCertificatePassword(company.certificatePassword!));
        console.log(
          `${company.ruc}: vence ${day(company.certificateExpiry)} → ${day(info.validTo)}` +
            ` · ${info.holder ?? 'sin titular'} · ${info.issuer ?? 'sin emisora'}`,
        );
        if (apply) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              certificateExpiry: info.validTo,
              certificateValidFrom: info.validFrom,
              certificateHolder: info.holder,
              certificateIssuer: info.issuer,
            },
          });
        }
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`${company.ruc}: no se pudo leer el certificado (${(error as Error).message})`);
      }
    }

    console.log(
      `${apply ? 'Actualizados' : 'Se actualizarían'}: ${updated} de ${companies.length}` +
        (failed ? ` · con error: ${failed}` : '') +
        (apply ? '' : ' · (modo prueba: agrega --apply para guardar)'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
