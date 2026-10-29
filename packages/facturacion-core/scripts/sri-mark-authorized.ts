/**
 * Corrige facturas que el SRI autorizó pero que la app guardó como PENDING,
 * SENT, REJECTED o ERROR (las encuentra scripts/sri-status-report.ts). Para
 * cada una vuelve a consultar el SRI y, solo si responde AUTORIZADO, guarda el
 * estado, el número y la fecha de autorización, igual que sendToSri.
 *
 * Sin --apply solo muestra lo que cambiaría. Corre en el servicio de Render:
 *
 *   npx ts-node --transpile-only scripts/sri-mark-authorized.ts           # revisar
 *   npx ts-node --transpile-only scripts/sri-mark-authorized.ts --apply   # guardar
 *
 * No toca las CANCELLED (si el SRI las autorizó, se anulan con nota de
 * crédito) ni las notas de crédito (cambiar su estado mueve el saldo de la
 * factura). No envía correos: el RIDE se genera al descargarlo y el correo se
 * manda desde la app.
 */
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SriWebServiceService } from '../src/modules/invoices/infrastructure/sri/sri-web-service.service';
import { classifyAuthorizationState } from '../src/modules/invoices/infrastructure/sri/sri-authorization-state';
import { R2StorageService } from '../src/shared/storage/r2-storage.service';

async function main() {
  const apply = process.argv.includes('--apply');
  Logger.overrideLogger(['error']); // sin los logs de cada consulta
  const prisma = new PrismaClient();
  // checkAuthorization no usa R2
  const sri = new SriWebServiceService(null as unknown as R2StorageService);

  try {
    const invoices = await prisma.invoice.findMany({
      where: { sriStatus: { in: ['PENDING', 'SENT', 'REJECTED', 'ERROR'] }, xmlSignedPath: { not: null } },
      select: {
        id: true,
        accessKey: true,
        establishmentCode: true,
        emissionPointCode: true,
        sequential: true,
        total: true,
        sriStatus: true,
        company: { select: { ruc: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    let fixed = 0;
    for (const invoice of invoices) {
      if (!/^\d{49}$/.test(invoice.accessKey)) continue; // nunca llegó al SRI
      const environment = invoice.accessKey[23] === '2' ? 'PRODUCTION' : 'TEST';
      const label =
        `${invoice.company.ruc} ${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}` +
        ` $${Number(invoice.total).toFixed(2)} (app ${invoice.sriStatus})`;

      let auth: Awaited<ReturnType<SriWebServiceService['checkAuthorization']>>;
      try {
        auth = await sri.checkAuthorization(invoice.accessKey, environment);
      } catch (error) {
        console.log(`  ${label}: no se pudo consultar (${(error as Error).message})`);
        continue;
      }
      if (classifyAuthorizationState(auth.estado) !== 'AUTHORIZED' || !auth.numeroAutorizacion) continue;

      const date = auth.fechaAutorizacion ?? null;
      console.log(
        `${apply ? 'Corregida' : 'Se corregiría'}: ${label} → AUTHORIZED, autorización ${auth.numeroAutorizacion}` +
          ` del ${date ? date.toISOString() : '?'}`,
      );
      if (apply) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            sriStatus: 'AUTHORIZED',
            authorizationNumber: auth.numeroAutorizacion,
            authorizationDate: date,
          },
        });
      }
      fixed++;
    }

    console.log(`\nRevisadas: ${invoices.length}. ${apply ? 'Corregidas' : 'Por corregir'}: ${fixed}.`);
    if (!apply && fixed > 0) console.log('Para guardar los cambios, vuelve a correrlo con --apply.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
