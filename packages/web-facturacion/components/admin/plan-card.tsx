'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FormField, Input, NativeSelect } from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageMeter } from '@/components/plans/usage-meter';
import { formatPeriod, PLAN_OPTIONS, PlanKey } from '@/lib/api/plans';
import {
  useAdminCompanyPlan,
  useGrantExtraDocuments,
  useSetCompanyPlan,
} from '@/lib/hooks/use-plan';

const STATE_TEXT = {
  UNLIMITED: 'Sin límite',
  OK: 'Dentro del plan',
  NEAR: 'Cerca del límite (80%)',
  OVER: 'Pasó el límite: usando el margen del 20%',
  BLOCKED: 'Bloqueada: no puede emitir facturas este mes',
} as const;

/** "2026-12-05" del día en Quito de un instante (para el campo de fecha). */
const quitoDay = (value: string) =>
  new Date(new Date(value).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

const formatDay = (value: string) =>
  new Date(value).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' });

/**
 * Número opcional de un campo de texto: vacío = usar el del plan (null). Un texto que no es un
 * número entero positivo da `undefined`, y el formulario no se guarda (nunca se borra un límite
 * pactado por un error de tipeo).
 */
const optionalInt = (value: string): number | null | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 ? Number(trimmed) : undefined;
};

/**
 * Plan de la empresa en el panel: elegir el plan, ajustar sus límites (A medida o un acuerdo),
 * ver el uso del mes y dar comprobantes extra para cobrarlos después.
 */
export function PlanCard({ companyId }: { companyId: string }) {
  const { data, isLoading } = useAdminCompanyPlan(companyId);
  const setPlan = useSetCompanyPlan(companyId);
  const grantExtra = useGrantExtraDocuments(companyId);

  const [plan, setPlanValue] = useState<PlanKey | ''>('');
  const [documents, setDocuments] = useState('');
  const [users, setUsers] = useState('');
  const [points, setPoints] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!data) return;
    setPlanValue(data.plan ?? '');
    setDocuments(data.overrides.documentLimitOverride?.toString() ?? '');
    setUsers(data.overrides.userLimitOverride?.toString() ?? '');
    setPoints(data.overrides.emissionPointLimitOverride?.toString() ?? '');
    setCycleStart(
      data.billingAnchor.source === 'CUSTOM' && data.billingAnchor.date
        ? quitoDay(data.billingAnchor.date)
        : '',
    );
  }, [data]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-on-surface-variant">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando plan…
        </CardContent>
      </Card>
    );
  }

  const limitsValid = [documents, users, points].every((value) => optionalInt(value) !== undefined);
  const savePlan = () =>
    setPlan.mutate({
      plan: plan || null,
      documentLimitOverride: optionalInt(documents) ?? null,
      userLimitOverride: optionalInt(users) ?? null,
      emissionPointLimitOverride: optionalInt(points) ?? null,
      billingCycleStart: cycleStart || null,
    });

  const extraCount = optionalInt(extra);
  const giveExtra = () => {
    if (!extraCount) return;
    grantExtra.mutate(
      { documents: extraCount, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setExtra('');
          setNote('');
        },
      },
    );
  };

  const { documents: usage } = data;
  const monthExtra = data.currentPeriodAllowances.reduce((sum, item) => sum + item.documents, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan</CardTitle>
        <CardDescription>
          {data.planName ? `${data.planName}` : 'Sin plan asignado: sin límites'} · ciclo{' '}
          {formatPeriod(data.period)}
          {data.environment === 'TEST' && ' (en pruebas no cuenta)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <UsageMeter
            label="Comprobantes de este ciclo"
            used={usage.used}
            limit={usage.allowed}
            state={usage.state}
          />
          <p className="text-body-sm text-on-surface-variant">
            {STATE_TEXT[usage.state]}
            {usage.hardLimit !== null && ` · se bloquea al llegar a ${usage.hardLimit}`}
            {monthExtra > 0 && ` · incluye ${monthExtra} extra en este ciclo`}
          </p>
          <UsageMeter label="Usuarios activos" used={data.users.used} limit={data.users.limit} />
          <UsageMeter
            label="Puntos de emisión"
            used={data.emissionPoints.used}
            limit={data.emissionPoints.limit}
          />
        </div>

        <div className="space-y-3 border-t border-outline-variant pt-4">
          <FormField label="Plan" htmlFor="plan">
            <NativeSelect
              id="plan"
              value={plan}
              onChange={(e) => setPlanValue(e.target.value as PlanKey | '')}
            >
              <option value="">Sin plan (sin límites)</option>
              {PLAN_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name} — {option.summary}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Comprobantes/mes" htmlFor="documentLimit" hint="Vacío: el del plan">
              <Input
                id="documentLimit"
                inputMode="numeric"
                value={documents}
                onChange={(e) => setDocuments(e.target.value)}
              />
            </FormField>
            <FormField label="Usuarios" htmlFor="userLimit" hint="Vacío: el del plan">
              <Input
                id="userLimit"
                inputMode="numeric"
                value={users}
                onChange={(e) => setUsers(e.target.value)}
              />
            </FormField>
            <FormField label="Puntos de emisión" htmlFor="pointLimit" hint="Vacío: el del plan">
              <Input
                id="pointLimit"
                inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            label="Inicio del ciclo de cobro"
            htmlFor="cycleStart"
            hint={
              data.productionSince
                ? `Vacío: el día en que pasó a producción (${formatDay(data.productionSince)}). Solo importa el día del mes.`
                : 'Vacío: el día en que pase a producción. Solo importa el día del mes.'
            }
          >
            <Input
              id="cycleStart"
              type="date"
              value={cycleStart}
              onChange={(e) => setCycleStart(e.target.value)}
              className="sm:max-w-xs"
            />
          </FormField>
          <p className="text-body-sm text-on-surface-variant">
            Al guardar se encienden los módulos que incluye el plan; no se apaga ninguno (los
            módulos se siguen controlando abajo).
          </p>
          {!limitsValid && (
            <p className="text-body-sm text-error">
              Los límites deben ser números enteros mayores a 0.
            </p>
          )}
          <Button onClick={savePlan} disabled={setPlan.isPending || !limitsValid}>
            {setPlan.isPending ? 'Guardando…' : 'Guardar plan'}
          </Button>
        </div>

        <div className="space-y-3 border-t border-outline-variant pt-4">
          <p className="text-title-sm text-on-surface">Comprobantes extra en este ciclo</p>
          <p className="text-body-sm text-on-surface-variant">
            Amplían lo permitido solo del {formatPeriod(data.period)}, para que no se quede sin
            facturar. Quedan registrados para cobrarlos después.
          </p>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <FormField label="Cantidad" htmlFor="extra">
              <Input
                id="extra"
                inputMode="numeric"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </FormField>
            <FormField label="Nota (cómo se cobra)" htmlFor="extraNote">
              <Input
                id="extraNote"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
            <Button
              variant="outlined"
              onClick={giveExtra}
              disabled={!extraCount || grantExtra.isPending}
            >
              Otorgar
            </Button>
          </div>
          {data.allowances.length > 0 && (
            <ul className="space-y-1 text-body-sm text-on-surface-variant">
              {data.allowances.map((allowance) => (
                <li key={allowance.id}>
                  Ciclo desde{' '}
                  {new Date(allowance.periodStart).toLocaleDateString('es-EC', {
                    timeZone: 'America/Guayaquil',
                  })}
                  : +{allowance.documents}
                  {allowance.note ? ` · ${allowance.note}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
