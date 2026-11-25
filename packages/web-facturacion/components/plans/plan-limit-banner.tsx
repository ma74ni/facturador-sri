'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMyPlanUsage } from '@/lib/hooks/use-plan';

const CONTACT = 'Escríbenos por WhatsApp al 0967155626 para ampliar tu plan.';

/**
 * Aviso del límite del plan (solo en producción): al 80%, al pasarlo (margen del 20%) y cuando ya
 * no se puede facturar este mes. Sin plan o dentro de él, no muestra nada.
 */
export function PlanLimitBanner() {
  const { data } = useMyPlanUsage();
  if (!data || data.environment !== 'PRODUCTION') return null;
  const { used, allowed, hardLimit, state } = data.documents;
  if (allowed === null || (state !== 'NEAR' && state !== 'OVER' && state !== 'BLOCKED'))
    return null;

  const plan = data.planName ?? 'tu plan';
  const content = {
    NEAR: {
      variant: 'warning' as const,
      title: `Usaste ${used} de ${allowed} comprobantes de tu plan ${plan} este mes`,
      text: `Te acercas al límite. ${CONTACT}`,
    },
    OVER: {
      variant: 'warning' as const,
      title: `Pasaste el límite de tu plan ${plan}: ${used} de ${allowed} comprobantes`,
      text: `Puedes seguir facturando hasta ${hardLimit} este mes. ${CONTACT}`,
    },
    BLOCKED: {
      variant: 'destructive' as const,
      title: `No puedes emitir más facturas este mes (${used} de ${allowed})`,
      text: `Llegaste al límite de tu plan ${plan}. ${CONTACT}`,
    },
  }[state];

  return (
    <Alert variant={content.variant}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>{content.text}</AlertDescription>
    </Alert>
  );
}
