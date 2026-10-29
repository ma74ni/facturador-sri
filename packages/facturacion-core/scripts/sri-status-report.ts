/**
 * Reporte de SOLO LECTURA: compara el estado que la app guardó con el que
 * tiene el SRI, para los comprobantes que pudieron quedar mal antes del
 * PR #41 (un "NO AUTORIZADO" o una espera agotada se guardaban como
 * REJECTED; una nota de crédito aún en proceso quedaba REJECTED y liberaba
 * su monto). No escribe nada en la base. Corre en el servicio de Render, que
 * ya tiene la base y las URLs del SRI:
 *
 *   npx ts-node scripts/sri-status-report.ts
 *
 * Revisa facturas y notas en PENDING, SENT, REJECTED, ERROR y CANCELLED que
 * tengan XML firmado (las demás nunca llegaron al SRI). El ambiente sale de la
 * clave de acceso (posición 24), no del ambiente actual de la empresa.
 */
import { Logger } from '@nestjs/common';
import { PrismaClient, SRIStatus } from '@prisma/client';
import { SriMessage, SriWebServiceService } from '../src/modules/invoices/infrastructure/sri/sri-web-service.service';
import { classifyAuthorizationState } from '../src/modules/invoices/infrastructure/sri/sri-authorization-state';
import { R2StorageService } from '../src/shared/storage/r2-storage.service';

const STATUSES: SRIStatus[] = ['PENDING', 'SENT', 'REJECTED', 'ERROR', 'CANCELLED'];

interface Document {
  kind: 'Factura' | 'Nota de crédito';
  ruc: string;
  number: string;
  issueDate: Date;
  total: number;
  appStatus: SRIStatus;
  accessKey: string;
}

type SriResult = 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'SIN REGISTRO' | 'ERROR DE CONSULTA';

/** Lo que significa para el negocio que la app y el SRI no coincidan. */
function finding(doc: Document, sri: SriResult): string | null {
  if (sri !== 'AUTORIZADO') return null;
  if (doc.kind === 'Factura' && doc.appStatus === 'CANCELLED') {
    return 'Autorizada en el SRI pero cancelada en la app: revisar si se volvió a emitir (posible doble cobro); se anula con nota de crédito';
  }
  if (doc.kind === 'Nota de crédito' && (doc.appStatus === 'REJECTED' || doc.appStatus === 'CANCELLED')) {
    return 'Nota autorizada en el SRI que la app no descuenta: liberó su monto y el saldo de la factura está mal';
  }
  return 'Autorizada en el SRI pero no en la app';
}

const day = (date: Date) => date.toISOString().slice(0, 10);

async function main() {
  Logger.overrideLogger(['error']); // sin los logs de cada consulta
  const prisma = new PrismaClient();
  // checkAuthorization no usa R2
  const sri = new SriWebServiceService(null as unknown as R2StorageService);

  try {
    const select = {
      accessKey: true,
      establishmentCode: true,
      emissionPointCode: true,
      sequential: true,
      issueDate: true,
      total: true,
      sriStatus: true,
      company: { select: { ruc: true } },
    } as const;
    const where = { sriStatus: { in: STATUSES }, xmlSignedPath: { not: null } };
    const [invoices, creditNotes] = await Promise.all([
      prisma.invoice.findMany({ where, select, orderBy: { issueDate: 'asc' } }),
      prisma.creditNote.findMany({ where, select, orderBy: { issueDate: 'asc' } }),
    ]);

    const documents: Document[] = [
      ...invoices.map((d) => ({ ...d, kind: 'Factura' as const })),
      ...creditNotes.map((d) => ({ ...d, kind: 'Nota de crédito' as const })),
    ].map((d) => ({
      kind: d.kind,
      ruc: d.company.ruc,
      number: `${d.establishmentCode}-${d.emissionPointCode}-${d.sequential}`,
      issueDate: d.issueDate,
      total: Number(d.total),
      appStatus: d.sriStatus,
      accessKey: d.accessKey,
    }));

    console.log(`Comprobantes a revisar: ${documents.length} (${invoices.length} facturas, ${creditNotes.length} notas)\n`);

    const findings: { doc: Document; sri: SriResult; detail: string; note: string }[] = [];
    const tally = new Map<string, number>();

    for (const doc of documents) {
      let result: SriResult;
      let detail = '';
      if (!/^\d{49}$/.test(doc.accessKey)) {
        result = 'SIN REGISTRO';
        detail = 'clave de acceso no válida';
      } else {
        const environment = doc.accessKey[23] === '2' ? 'PRODUCTION' : 'TEST';
        try {
          const auth = await sri.checkAuthorization(doc.accessKey, environment);
          const verdict = classifyAuthorizationState(auth.estado);
          if (auth.estado === 'NO_AUTORIZADA') {
            result = 'SIN REGISTRO'; // el SRI no devolvió autorizaciones para esa clave
          } else if (verdict === 'AUTHORIZED') {
            result = 'AUTORIZADO';
            detail = `autorizado el ${auth.fechaAutorizacion ? day(auth.fechaAutorizacion) : '?'}`;
          } else if (verdict === 'REJECTED') {
            result = 'NO AUTORIZADO';
            detail = (auth.mensajes ?? [])
              .map((m: SriMessage) => [m.mensaje, m.informacionAdicional].filter(Boolean).join(': '))
              .join('; ');
          } else {
            result = 'EN PROCESO';
          }
        } catch (error) {
          result = 'ERROR DE CONSULTA';
          detail = (error as Error).message;
        }
      }

      const key = `${doc.kind} ${doc.appStatus} → SRI ${result}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);

      const note = finding(doc, result);
      if (note) findings.push({ doc, sri: result, detail, note });

      console.log(
        `${doc.kind.padEnd(15)} ${doc.ruc} ${doc.number} ${day(doc.issueDate)} $${doc.total.toFixed(2).padStart(9)}` +
          `  app ${doc.appStatus.padEnd(9)} SRI ${result}${detail ? ` (${detail})` : ''}`,
      );
    }

    console.log('\nResumen:');
    for (const [key, count] of [...tally.entries()].sort()) console.log(`  ${count.toString().padStart(4)}  ${key}`);

    console.log(`\nDiscrepancias que requieren acción: ${findings.length}`);
    for (const { doc, detail, note } of findings) {
      console.log(`  - ${doc.kind} ${doc.ruc} ${doc.number} ($${doc.total.toFixed(2)}, app ${doc.appStatus}, ${detail}): ${note}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
