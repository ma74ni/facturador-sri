'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, FileSpreadsheet, Info, Loader2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  FormField,
  Input,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form104Box,
  PurchaseReport,
  ReportDocumentRow,
  UNLOCATED_BOXES,
} from '@/lib/api/purchase-reports';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
import { usePurchaseReport } from '@/lib/hooks/use-received-documents';
import { RECEIVED_DOCUMENT_TYPES } from '@/lib/sri-catalogs';
import { formatCurrency } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

const monthName = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es-EC', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
  return `${label} ${year}`;
};

const periodLabel = (report: PurchaseReport) =>
  report.from === report.to
    ? monthName(report.from)
    : `${monthName(report.from)} a ${monthName(report.to)}`;

const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Los semestres ya cerrados, del más reciente al más viejo, para quien declara IVA semestral. Con
 * la fecha de Ecuador, como el backend.
 */
function semesters(count = 4) {
  const today = new Date(Date.now() - 5 * 60 * 60 * 1000);
  let year = today.getUTCFullYear();
  // El último cerrado: en el primer semestre, el segundo del año anterior.
  let first = today.getUTCMonth() >= 6;
  if (!first) year--;
  const list: { from: string; to: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    list.push(
      first
        ? { from: `${year}-01`, to: `${year}-06`, label: `Enero a junio ${year}` }
        : { from: `${year}-07`, to: `${year}-12`, label: `Julio a diciembre ${year}` },
    );
    if (first) year--;
    first = !first;
  }
  return list;
}

const money = (value: number) => value.toFixed(2);
/**
 * Para CSV: entre comillas, con las comillas internas dobladas. Un texto que empieza con =, +, -, @
 * o un tabulador se antepone con ' para que Excel no lo ejecute como fórmula (una razón social
 * viene de terceros).
 */
const cell = (value: string | number | null | undefined) => {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

/**
 * Detalle para el contador: una fila por compra, con sus bases por tratamiento de IVA. Se abre en
 * Excel (con BOM para que respete las tildes), como el reporte de ventas.
 */
function downloadDetail(report: PurchaseReport) {
  const base = (doc: ReportDocumentRow, predicate: (code: string, rate: number) => boolean) =>
    money(
      doc.taxes
        .filter((tax) => predicate(tax.ivaCode, tax.ivaRate))
        .reduce((sum, tax) => sum + tax.taxBase, 0),
    );
  const headers = [
    'Fecha de emisión',
    'Tipo',
    'Número',
    'Autorización',
    'RUC proveedor',
    'Proveedor',
    'Base 0 %',
    'Base 15 %',
    'Base 5 %',
    'Base otras tarifas',
    'No objeto',
    'Exento',
    'IVA',
    'ICE',
    'Otros valores',
    'Total',
    'Sustento',
    'Forma de pago',
    'Cuenta de gasto',
    'Casilla 104',
  ];
  const rows = report.documents.map((doc) => [
    formatDate(doc.issueDate),
    RECEIVED_DOCUMENT_TYPES[doc.documentType] ?? doc.documentType,
    doc.number,
    doc.authorizationNumber ?? '',
    doc.supplier.identification,
    doc.supplier.businessName,
    base(doc, (code) => code === '0'),
    base(doc, (code) => code === '4'),
    base(doc, (code) => code === '5'),
    base(doc, (code, rate) => rate > 0 && code !== '4' && code !== '5'),
    base(doc, (code) => code === '6'),
    base(doc, (code) => code === '7'),
    money(doc.taxes.reduce((sum, tax) => sum + tax.ivaValue, 0)),
    money(doc.iceValue),
    money(doc.otherCharges),
    money(doc.total),
    doc.taxSupportCode ?? '',
    doc.paymentMethodCode ?? '',
    doc.expenseAccount
      ? [doc.expenseAccount.code, doc.expenseAccount.name].filter(Boolean).join(' ')
      : '',
    doc.boxes
      .map((box) =>
        box === 'NONE' ? 'sin ubicar' : box === 'SALE_NOTE' ? 'nota de venta por revisar' : box,
      )
      .join(' y '),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compras-${report.from}${report.to !== report.from ? `-a-${report.to}` : ''}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/** C4: compras del período por casilla del formulario 104, con el detalle para el contador. */
export default function ReporteComprasPage() {
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [openBox, setOpenBox] = useState<Form104Box | null>(null);
  const [allSuppliers, setAllSuppliers] = useState(false);
  const [allAccounts, setAllAccounts] = useState(false);
  const { data: report, isLoading, isFetching, error } = usePurchaseReport(period);
  const semesterOptions = useMemo(() => semesters(), []);

  const boxDocuments = useMemo(
    () => (report && openBox ? report.documents.filter((doc) => doc.boxes.includes(openBox)) : []),
    [report, openBox],
  );
  // Los enlaces a la lista de Compras abren un mes: el del reporte si es uno solo.
  const listLink = (filter: string) =>
    `/dashboard/compras?${report && report.from === report.to ? `mes=${report.from}&` : ''}${filter}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Reporte de compras</h1>
          <p className="text-body-md text-on-surface-variant">
            Lo que va en el formulario 104 y el detalle para tu contador
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {report?.vatFilingPeriod === 'SEMIANNUAL' ? (
            <FormField label="Semestre" htmlFor="report-period">
              <NativeSelect
                id="report-period"
                value={`${report.from}|${report.to}`}
                onChange={(e) => {
                  const [from, to] = e.target.value.split('|');
                  setPeriod({ from, to });
                }}
              >
                {semesterOptions.map((option) => (
                  <option key={option.from} value={`${option.from}|${option.to}`}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <FormField label="Mes" htmlFor="report-month">
              <Input
                id="report-month"
                type="month"
                value={report?.from ?? ''}
                onChange={(e) =>
                  e.target.value && setPeriod({ from: e.target.value, to: e.target.value })
                }
              />
            </FormField>
          )}
          <Button
            variant="outlined"
            disabled={!report || report.count === 0}
            onClick={() => report && downloadDetail(report)}
          >
            <FileSpreadsheet />
            Descargar detalle
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            {apiErrorMessage(error, 'No se pudo armar el reporte')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading || !report ? (
        !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
          </div>
        )
      ) : (
        <div className={cn('space-y-4 sm:space-y-6', isFetching && 'opacity-70')}>
          <div className="space-y-2">
            {report.withoutSupport.count > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  {report.withoutSupport.count === 1
                    ? '1 compra con IVA no tiene sustento tributario'
                    : `${report.withoutSupport.count} compras con IVA no tienen sustento tributario`}{' '}
                  ({formatCurrency(report.withoutSupport.gross)} de base): no se sabe si dan crédito
                  tributario.{' '}
                  <Link href={listLink('sinSustento=1')} className="underline">
                    Asignar sustento
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            {report.saleNotesToReview.count > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  {report.saleNotesToReview.count === 1
                    ? '1 nota de venta es de un proveedor que no está marcado'
                    : `${report.saleNotesToReview.count} notas de venta son de proveedores que no están marcados`}{' '}
                  como negocio popular: solo ellos emiten notas de venta. Márcalo en{' '}
                  <Link href="/dashboard/compras/proveedores" className="underline">
                    Proveedores
                  </Link>{' '}
                  o revisa el documento con tu contador.
                </AlertDescription>
              </Alert>
            )}
            {report.cashOverLimit > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  {report.cashOverLimit === 1
                    ? '1 compra con crédito tributario se pagó'
                    : `${report.cashOverLimit} compras con crédito tributario se pagaron`}{' '}
                  en efectivo por $500 o más. Revisa con tu contador si conservan el crédito: la ley
                  pide pagarlas por el sistema financiero.
                </AlertDescription>
              </Alert>
            )}
            {report.iceAmbiguous > 0 && (
              <Alert>
                <Info />
                <AlertDescription>
                  {report.iceAmbiguous === 1
                    ? '1 compra tiene ICE y dos tarifas con IVA'
                    : `${report.iceAmbiguous} compras tienen ICE y dos tarifas con IVA`}
                  : el ICE se sumó a la base de la tarifa mayor.
                </AlertDescription>
              </Alert>
            )}
            {report.pending.count > 0 && (
              <Alert>
                <Clock />
                <AlertDescription>
                  {report.pending.count === 1
                    ? '1 compra importada no tiene su detalle'
                    : `${report.pending.count} compras importadas no tienen su detalle`}{' '}
                  ({formatCurrency(report.pending.total)}): no están en el reporte.{' '}
                  <Link href={listLink('pendientes=1')} className="underline">
                    Ver
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            <Alert variant="info">
              <Info />
              <AlertDescription>
                Las notas de crédito que te dieron tus proveedores todavía no se registran: si
                recibiste alguna, réstala en el valor neto.
              </AlertDescription>
            </Alert>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compras para el formulario 104</CardTitle>
              <CardDescription>
                {periodLabel(report)} · {report.count}{' '}
                {report.count === 1 ? 'compra registrada' : 'compras registradas'}. Toca una casilla
                para ver sus compras.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Casilla</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Valor bruto</TableHead>
                    <TableHead className="text-right">Valor neto</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.boxes
                    .filter((row) => !UNLOCATED_BOXES.includes(row.box) || row.count > 0)
                    .map((row) => {
                      const missing = UNLOCATED_BOXES.includes(row.box);
                      return (
                        <TableRow
                          key={row.box}
                          className={cn(
                            row.count > 0 && 'cursor-pointer',
                            openBox === row.box && 'bg-secondary-container',
                            missing && 'text-warning',
                          )}
                          onClick={() =>
                            row.count > 0 && setOpenBox(openBox === row.box ? null : row.box)
                          }
                        >
                          <TableCell className="font-mono text-on-surface-variant">
                            {missing ? '—' : row.box}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {row.count > 0 ? (
                              <button
                                type="button"
                                className="text-left hover:underline"
                                aria-expanded={openBox === row.box}
                              >
                                {row.label}
                              </button>
                            ) : (
                              row.label
                            )}
                            {row.count > 0 && (
                              <span className="ml-1 text-body-sm text-on-surface-variant">
                                ({row.count})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.gross)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.net)}</TableCell>
                          <TableCell className="text-right">
                            {row.hasIva ? formatCurrency(row.iva) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  <TableRow className="text-title-sm">
                    <TableCell className="font-mono text-on-surface-variant">509</TableCell>
                    <TableCell className="whitespace-normal">
                      Total
                      <span className="block text-body-sm text-on-surface-variant">
                        Bruto en la 509, neto en la 519 e IVA en la 529
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totals.gross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totals.net)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totals.iva)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {openBox && boxDocuments.length > 0 && (
                <section
                  aria-label="Compras de la casilla"
                  className="rounded-lg border border-outline-variant"
                >
                  <p className="border-b border-outline-variant px-3 py-2 text-label-lg text-on-surface">
                    {openBox === 'NONE'
                      ? 'Compras sin ubicar'
                      : openBox === 'SALE_NOTE'
                        ? 'Notas de venta por revisar'
                        : `Compras de la casilla ${openBox}`}
                  </p>
                  <ul className="divide-y divide-outline-variant">
                    {boxDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap justify-between gap-2 px-3 py-2 text-body-md"
                      >
                        <span>
                          {formatDate(doc.issueDate)} · {doc.supplier.businessName}{' '}
                          <span className="font-mono text-body-sm text-on-surface-variant">
                            {doc.number}
                          </span>
                        </span>
                        <span>{formatCurrency(doc.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {report.byRate.map((rate) => (
                  <div
                    key={rate.ivaCode}
                    className="flex justify-between rounded-lg bg-surface-container-low px-3 py-2 text-body-md"
                  >
                    <span className="text-on-surface-variant">
                      Base{' '}
                      {rate.ivaCode === '6'
                        ? 'no objeto'
                        : rate.ivaCode === '7'
                          ? 'exenta'
                          : `${rate.ivaRate} %`}
                    </span>
                    <span>
                      {formatCurrency(rate.taxBase)}
                      {rate.ivaRate > 0 && (
                        <span className="text-on-surface-variant">
                          {' '}
                          · IVA {formatCurrency(rate.ivaValue)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {report.iceValue > 0 && (
                  <div className="flex justify-between rounded-lg bg-surface-container-low px-3 py-2 text-body-md">
                    <span className="text-on-surface-variant">ICE</span>
                    <span>{formatCurrency(report.iceValue)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por proveedor</CardTitle>
              </CardHeader>
              <CardContent>
                {report.bySupplier.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Sin compras en el período.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant">
                    {(allSuppliers ? report.bySupplier : report.bySupplier.slice(0, 5)).map(
                      (row) => (
                        <li key={row.id} className="flex justify-between gap-2 py-2 text-body-md">
                          <span className="min-w-0">
                            {row.businessName}{' '}
                            <span className="text-body-sm text-on-surface-variant">
                              ({row.count})
                            </span>
                          </span>
                          <span>{formatCurrency(row.total)}</span>
                        </li>
                      ),
                    )}
                  </ul>
                )}
                {report.bySupplier.length > 5 && (
                  <Button variant="text" size="sm" onClick={() => setAllSuppliers((v) => !v)}>
                    {allSuppliers ? 'Ver menos' : `Ver los ${report.bySupplier.length}`}
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por cuenta de gasto</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byAccount.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Sin compras en el período.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant">
                    {(allAccounts ? report.byAccount : report.byAccount.slice(0, 5)).map((row) => (
                      <li
                        key={row.id ?? 'none'}
                        className={cn(
                          'flex justify-between gap-2 py-2 text-body-md',
                          !row.id && 'text-warning',
                        )}
                      >
                        <span className="min-w-0">
                          {row.id ? [row.code, row.name].filter(Boolean).join(' · ') : 'Sin cuenta'}{' '}
                          <span className="text-body-sm text-on-surface-variant">
                            ({row.count})
                          </span>
                        </span>
                        <span>{formatCurrency(row.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {report.byAccount.length > 5 && (
                  <Button variant="text" size="sm" onClick={() => setAllAccounts((v) => !v)}>
                    {allAccounts ? 'Ver menos' : `Ver todas (${report.byAccount.length})`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
