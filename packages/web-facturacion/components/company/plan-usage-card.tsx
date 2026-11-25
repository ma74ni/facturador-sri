'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageMeter } from '@/components/plans/usage-meter';
import { useMyPlanUsage } from '@/lib/hooks/use-plan';

/** "Tu plan" en la página Empresa: el plan contratado y su uso del mes. */
export function PlanUsageCard() {
  const { data } = useMyPlanUsage();
  if (!data || !data.plan) return null;
  const { documents } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu plan: {data.planName}</CardTitle>
        <CardDescription>
          Uso de este mes. Cuentan las facturas y notas de crédito autorizadas por el SRI
          {data.environment === 'TEST' && ' (en modo pruebas no cuentan)'}. Para cambiar de plan,
          escríbenos por WhatsApp al 0967155626.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <UsageMeter
          label="Comprobantes"
          used={documents.used}
          limit={documents.allowed}
          state={documents.state}
        />
        <UsageMeter label="Usuarios" used={data.users.used} limit={data.users.limit} />
        <UsageMeter
          label="Puntos de emisión"
          used={data.emissionPoints.used}
          limit={data.emissionPoints.limit}
        />
      </CardContent>
    </Card>
  );
}
