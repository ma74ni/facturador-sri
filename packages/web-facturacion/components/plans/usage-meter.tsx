import { cn } from '@facturador-sri/ui';
import type { DocumentUsageState } from '@/lib/api/plans';

const BAR: Record<DocumentUsageState, string> = {
  UNLIMITED: 'bg-primary',
  OK: 'bg-primary',
  NEAR: 'bg-warning',
  OVER: 'bg-warning',
  BLOCKED: 'bg-error',
};

interface UsageMeterProps {
  label: string;
  used: number;
  /** null = sin límite. */
  limit: number | null;
  state?: DocumentUsageState;
}

/** "Comprobantes este mes: 170 de 200" con su barra (sin límite, solo el número). */
export function UsageMeter({ label, used, limit, state = 'OK' }: UsageMeterProps) {
  const ratio = limit ? Math.min(used / limit, 1) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-body-md">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-medium text-on-surface">
          {used.toLocaleString('es-EC')}
          {limit !== null ? ` de ${limit.toLocaleString('es-EC')}` : ' · sin límite'}
        </span>
      </div>
      {limit !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
        >
          <div
            className={cn('h-full rounded-full', BAR[state])}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
