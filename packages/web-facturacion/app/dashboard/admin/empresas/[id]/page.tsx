'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Rocket, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { CompanyStatusBadge, ReadinessChecklist } from '@/components/admin/company-status';
import { GoLiveDialog } from '@/components/admin/go-live-dialog';
import { RejectDialog } from '@/components/admin/reject-dialog';
import { SequenceDialog } from '@/components/admin/sequence-dialog';
import { ModulesCard } from '@/components/admin/modules-card';
import { AdminEmissionPoint } from '@/lib/api/platform-admin';
import { useAdminCompany, useApproveCompany } from '@/lib/hooks/use-platform-admin';

const ACTION_LABEL: Record<string, string> = {
  COMPANY_APPROVED: 'Aprobó la empresa',
  COMPANY_REJECTED: 'Rechazó la empresa',
  COMPANY_WENT_LIVE: 'Pasó la empresa a producción',
  EMISSION_SEQUENCE_CHANGED: 'Cambió una numeración',
  COMPANY_MODULES_CHANGED: 'Cambió los módulos',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  USER: 'Usuario',
  VIEWER: 'Solo lectura',
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AdminEmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useAdminCompany(id);
  const approve = useApproveCompany(id);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<(AdminEmissionPoint & { label: string }) | null>(null);

  const points = useMemo(
    () =>
      company?.establishments.flatMap((establishment) =>
        establishment.emissionPoints.map((point) => ({
          ...point,
          label: `${establishment.code}-${point.code}`,
          establishmentName: establishment.name,
        })),
      ) ?? [],
    [company],
  );

  if (isLoading || !company) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inProduction = company.environment === 'PRODUCTION';
  const canApprove = !inProduction && company.status !== 'APPROVED';
  const canReject = !inProduction && company.status !== 'REJECTED';
  const canGoLive = !inProduction && company.readiness.ready;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/empresas" className="inline-flex items-center text-sm text-muted-foreground hover:text-slate-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Empresas
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{company.businessName}</h2>
            <CompanyStatusBadge status={company.status} environment={company.environment} />
          </div>
          <p className="text-sm text-muted-foreground">
            RUC {company.ruc}
            {company.tradeName ? ` · ${company.tradeName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <Button variant="outline" onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aprobar
            </Button>
          )}
          {canReject && (
            <Button variant="outline" onClick={() => setRejectOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Rechazar
            </Button>
          )}
          {!inProduction && (
            <Button
              onClick={() => setGoLiveOpen(true)}
              disabled={!canGoLive}
              title={canGoLive ? undefined : 'Primero debe cumplir todos los requisitos'}
            >
              <Rocket className="mr-2 h-4 w-4" />
              Pasar a producción
            </Button>
          )}
        </div>
      </div>

      {company.status === 'REJECTED' && company.rejectionReason && (
        <Alert variant="destructive">
          <AlertTitle>Motivo del rechazo</AlertTitle>
          <AlertDescription>{company.rejectionReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requisitos para producción</CardTitle>
            <CardDescription>
              {inProduction
                ? `En producción desde ${formatDate(company.productionSince)}`
                : company.readiness.ready
                  ? 'Cumple todo: ya puede pasar a producción.'
                  : 'Falta lo marcado en rojo.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReadinessChecklist readiness={company.readiness} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de la empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Correo:</span> {company.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {company.phone || '—'}</p>
            <p><span className="text-muted-foreground">Dirección:</span> {company.address}</p>
            <p><span className="text-muted-foreground">Registrada:</span> {formatDate(company.createdAt)}</p>
            {company.approvedAt && (
              <p><span className="text-muted-foreground">Aprobada:</span> {formatDate(company.approvedAt)}</p>
            )}
            {!inProduction && company.testDocuments.invoices + company.testDocuments.creditNotes > 0 && (
              <p>
                <span className="text-muted-foreground">Emitido en pruebas:</span> {company.testDocuments.invoices}{' '}
                factura(s), {company.testDocuments.creditNotes} nota(s) de crédito
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Puntos de emisión</CardTitle>
          <CardDescription>El número que usará el próximo comprobante de cada punto.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              La empresa no ha creado puntos de emisión. Los crea desde su panel, en Empresa.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punto</TableHead>
                  <TableHead className="text-right">Siguiente factura</TableHead>
                  <TableHead className="text-right">Siguiente nota de crédito</TableHead>
                  <TableHead className="text-right">Último emitido en producción</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell>
                      <p className="font-mono">{point.label}</p>
                      <p className="text-xs text-muted-foreground">{point.description || point.establishmentName}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono">{point.invoiceSequence}</TableCell>
                    <TableCell className="text-right font-mono">{point.creditNoteSequence}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {point.lastInvoiceIssued ?? '—'}
                      {point.lastCreditNoteIssued ? ` / NC ${point.lastCreditNoteIssued}` : ''}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Ajustar numeración de ${point.label}`}
                        onClick={() => setEditingPoint(point)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModulesCard companyId={company.id} enabledModules={company.enabledModules} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <Badge variant="outline">{ROLE_LABEL[member.role] ?? member.role}</Badge>
                  {member.emailVerified ? (
                    <Badge variant="success">Verificado</Badge>
                  ) : (
                    <Badge variant="warning">Sin verificar</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {company.auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin acciones del panel todavía.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {company.auditLog.map((entry) => (
                  <li key={entry.id}>
                    <p>{ACTION_LABEL[entry.action] ?? entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorEmail} · {formatDate(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprobar {company.businessName}</AlertDialogTitle>
            <AlertDialogDescription>
              Seguirá emitiendo en el ambiente de pruebas hasta que la pases a producción. Se le enviará un correo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={approve.isPending}
              onClick={(event) => {
                event.preventDefault();
                approve.mutate(undefined, { onSuccess: () => setApproveOpen(false) });
              }}
            >
              {approve.isPending ? 'Aprobando...' : 'Aprobar y avisar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectDialog companyId={company.id} companyName={company.businessName} open={rejectOpen} onOpenChange={setRejectOpen} />
      <GoLiveDialog company={company} open={goLiveOpen} onOpenChange={setGoLiveOpen} />
      <SequenceDialog companyId={company.id} point={editingPoint} onOpenChange={(open) => !open && setEditingPoint(null)} />
    </div>
  );
}
