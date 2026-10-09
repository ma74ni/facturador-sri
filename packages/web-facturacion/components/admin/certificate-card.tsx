'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminCompanyDetail, CompanyReadiness } from '@/lib/api/platform-admin';
import { useSendCertificateReminder } from '@/lib/hooks/use-platform-admin';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });

/** Vencimiento del certificado con color: rojo vencido/sin certificado, amarillo < 30 días. */
export function CertificateExpiry({
  hasCertificate,
  expiry,
  readiness,
}: {
  hasCertificate: boolean;
  expiry: string | null;
  readiness: CompanyReadiness;
}) {
  if (!hasCertificate || !expiry) {
    return <span className="text-sm text-red-600">{hasCertificate ? 'Sin fecha' : 'Sin certificado'}</span>;
  }
  const days = readiness.certificateDaysLeft;
  const expired = days !== null && days < 0;
  const tone = expired ? 'text-red-600' : readiness.certificateExpiringSoon ? 'text-yellow-700' : 'text-slate-700';
  return (
    <div className={`text-sm ${tone}`}>
      <p>{formatDate(expiry)}</p>
      <p className="text-xs">{expired ? 'Vencido' : `${days} días`}</p>
    </div>
  );
}

/** Certificado de firma de una empresa y recordatorio de renovación. */
export function CertificateCard({ company }: { company: AdminCompanyDetail }) {
  const reminder = useSendCertificateReminder(company.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canRemind = company.hasCertificate && !!company.certificateExpiry;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Certificado de firma</CardTitle>
        <CardDescription>Datos leídos del archivo .p12 que subió la empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!company.hasCertificate ? (
          <p className="text-muted-foreground">La empresa todavía no ha cargado su certificado.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Titular:</span> {company.certificateHolder || '—'}</p>
                <p><span className="text-muted-foreground">Emisora:</span> {company.certificateIssuer || '—'}</p>
                {company.certificateValidFrom && (
                  <p><span className="text-muted-foreground">Vigente desde:</span> {formatDate(company.certificateValidFrom)}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Vence</p>
                <CertificateExpiry
                  hasCertificate={company.hasCertificate}
                  expiry={company.certificateExpiry}
                  readiness={company.readiness}
                />
              </div>
            </div>

            <Button variant="outline" size="sm" disabled={!canRemind || reminder.isPending} onClick={() => setConfirmOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Enviar recordatorio de renovación
            </Button>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar recordatorio</AlertDialogTitle>
            <AlertDialogDescription>
              {company.businessName} recibirá un correo con la fecha de vencimiento de su certificado y cómo subir el
              nuevo. Se envía a su correo y a sus administradores verificados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reminder.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reminder.isPending}
              onClick={(event) => {
                event.preventDefault();
                reminder.mutate(undefined, { onSettled: () => setConfirmOpen(false) });
              }}
            >
              {reminder.isPending ? 'Enviando...' : 'Enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
