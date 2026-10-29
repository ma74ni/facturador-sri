import { AlertCircle, Ban, CheckCircle2, Clock, Send, XCircle, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeProps } from '@facturador-sri/ui';

export type SriStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SENT'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'ERROR'
  | 'CANCELLED';

const STATUS: Record<SriStatus, { variant: BadgeProps['variant']; icon: LucideIcon; label: string }> = {
  DRAFT: { variant: 'secondary', icon: Clock, label: 'Borrador' },
  PENDING: { variant: 'warning', icon: Clock, label: 'Pendiente' },
  SENT: { variant: 'info', icon: Send, label: 'Enviada' },
  AUTHORIZED: { variant: 'success', icon: CheckCircle2, label: 'Autorizada' },
  REJECTED: { variant: 'destructive', icon: XCircle, label: 'Rechazada' },
  ERROR: { variant: 'destructive', icon: AlertCircle, label: 'Error' },
  CANCELLED: { variant: 'secondary', icon: Ban, label: 'Cancelada' },
};

/** Estado SRI de una factura o nota de crédito, con el mismo color en todas las pantallas. */
export function SriStatusBadge({ status }: { status: string }) {
  const config = STATUS[status as SriStatus];
  if (!config) {
    return (
      <Badge variant="secondary">
        <AlertCircle />
        {status || 'Desconocido'}
      </Badge>
    );
  }
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon />
      {config.label}
    </Badge>
  );
}
