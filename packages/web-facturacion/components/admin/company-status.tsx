import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CompanyReadiness, CompanyStatus } from '@/lib/api/platform-admin';

/** Estado de una empresa en una sola etiqueta: producción manda sobre la aprobación. */
export function CompanyStatusBadge({
  status,
  environment,
}: {
  status: CompanyStatus;
  environment: 'TEST' | 'PRODUCTION';
}) {
  if (environment === 'PRODUCTION') return <Badge variant="success">En producción</Badge>;
  if (status === 'APPROVED') return <Badge variant="info">Aprobada · pruebas</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive">Rechazada</Badge>;
  return <Badge variant="warning">Pendiente</Badge>;
}

const SHORT_LABEL: Record<string, string> = {
  APPROVED: 'Aprobada',
  EMAIL_VERIFIED: 'Correo',
  CERTIFICATE: 'Certificado',
  EMISSION_POINT: 'Punto de emisión',
};

/** Requisitos en forma compacta (para tablas). */
export function ReadinessPills({ readiness }: { readiness: CompanyReadiness }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {readiness.checks.map((check) => {
        const warn = check.key === 'CERTIFICATE' && check.ok && readiness.certificateExpiringSoon;
        return (
          <span
            key={check.key}
            title={check.message}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
              !check.ok
                ? 'bg-red-50 text-red-700'
                : warn
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-green-50 text-green-700'
            }`}
          >
            {!check.ok ? (
              <XCircle className="h-3 w-3" />
            ) : warn ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {SHORT_LABEL[check.key]}
            {warn && readiness.certificateDaysLeft !== null ? ` · ${readiness.certificateDaysLeft} d` : ''}
          </span>
        );
      })}
    </div>
  );
}

/** Requisitos con su explicación (para el detalle). */
export function ReadinessChecklist({ readiness }: { readiness: CompanyReadiness }) {
  return (
    <ul className="space-y-2">
      {readiness.checks.map((check) => {
        const warn = check.key === 'CERTIFICATE' && check.ok && readiness.certificateExpiringSoon;
        return (
          <li key={check.key} className="flex items-start gap-2 text-sm">
            {!check.ok ? (
              <XCircle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
            ) : warn ? (
              <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
            )}
            <span className={check.ok ? 'text-slate-700' : 'text-red-700'}>
              {check.message}
              {warn ? ' — pídele que lo renueve' : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
