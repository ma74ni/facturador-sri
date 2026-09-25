'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ImportBlock } from '@/components/payments/import-block';
import { historicalImportApi } from '@/lib/api/historical-import';

export default function ImportarHistoricoPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/dashboard/cobranza"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a Cobranza
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Importar histórico</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Cargá facturas y pagos anteriores a este sistema, para que Cobranza muestre la deuda real
          desde el día uno. Primero las facturas, después los pagos (los pagos aplican sobre
          facturas que ya tienen que estar importadas).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Facturas históricas</CardTitle>
          <CardDescription>
            El reporte de comprobantes electrónicos que se descarga directo del portal del SRI —
            se sube tal cual, sin editar nada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportBlock
            title="Export de comprobantes del SRI"
            description="Archivo .txt con columnas FECHA_EMISION, COMPROBANTE, NUMERO_COMPROBANTE, IDENTIFICACION_RECEPTOR, RAZON_SOCIAL, CLAVE_ACCESO, VALOR_TOTAL."
            accept=".txt"
            columnsHint="Solo se importan las filas con COMPROBANTE = Factura."
            onPreview={(file) => historicalImportApi.importInvoices(file, true)}
            onConfirm={(file) => historicalImportApi.importInvoices(file, false)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Pagos históricos</CardTitle>
          <CardDescription>
            Los pagos que ya le hicieron al cliente por esas facturas (lo que hoy se cruza a mano
            contra los comprobantes que te mandan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportBlock
            title="CSV de pagos"
            description="Una fila por factura cubierta en cada pago."
            accept=".csv"
            columnsHint="Columnas: identificacion, referencia, fechaPago, numeroFactura, montoAplicado, retencion (retencion es opcional)."
            onPreview={(file) => historicalImportApi.importPayments(file, true)}
            onConfirm={(file) => historicalImportApi.importPayments(file, false)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
