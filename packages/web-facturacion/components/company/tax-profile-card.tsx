'use client';

import { useState } from 'react';
import { Edit, Info, Save, X } from 'lucide-react';
import { FormField, Input, NativeSelect } from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
import {
  companyApi,
  CompanyTaxProfile,
  TAX_REGIME_LABELS,
  TaxRegime,
  VAT_FILING_PERIOD_LABELS,
  VatFilingPeriod,
} from '@/lib/api/company';

type Form = {
  taxRegime: TaxRegime;
  keepsAccounting: 'SI' | 'NO';
  vatFilingPeriod: VatFilingPeriod;
  withholdingAgentResolution: string;
  specialTaxpayerResolution: string;
};

type Errors = Partial<Record<'withholdingAgentResolution' | 'specialTaxpayerResolution', string>>;

/** Lo que tiene guardado la empresa; sin perfil cargado, lo que se emitía antes. */
const fromCompany = (company: Partial<CompanyTaxProfile> | null | undefined): Form => ({
  taxRegime: company?.taxRegime ?? 'GENERAL',
  keepsAccounting: company?.keepsAccounting === false ? 'NO' : 'SI',
  vatFilingPeriod: company?.vatFilingPeriod ?? 'MONTHLY',
  withholdingAgentResolution: company?.withholdingAgentResolution ?? '',
  specialTaxpayerResolution: company?.specialTaxpayerResolution ?? '',
});

/** Las mismas reglas que la API: el XML del SRI solo acepta el número de la resolución. */
function validate(form: Form): Errors {
  const errors: Errors = {};
  // Como viene en el documento del SRI (NAC-…-00000001): la API quita los ceros a la izquierda.
  const agent = form.withholdingAgentResolution.trim().replace(/^0+(?=\d)/, '');
  const special = form.specialTaxpayerResolution.trim();
  if (agent && !/^[1-9]\d{0,7}$/.test(agent)) {
    errors.withholdingAgentResolution = 'Escribe solo el número de la resolución (por ejemplo, 1)';
  }
  if (special && !/^\d{3,13}$/.test(special)) {
    errors.specialTaxpayerResolution = 'Debe tener de 3 a 13 dígitos';
  }
  return errors;
}

/**
 * Perfil tributario de la empresa: cómo la ve el SRI. Sale en el XML y el RIDE de lo que emita desde
 * ahora (obligado a llevar contabilidad, leyenda RIMPE, agente de retención, contribuyente especial).
 * Solo un administrador de la empresa lo edita.
 */
export function TaxProfileCard() {
  const { user, company, checkAuth } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(() => fromCompany(company));
  const [errors, setErrors] = useState<Errors>({});
  const isAdmin = user?.role === 'ADMIN';

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const startEditing = () => {
    setForm(fromCompany(company));
    setErrors({});
    setEditing(true);
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await companyApi.update({
        taxRegime: form.taxRegime,
        keepsAccounting: form.keepsAccounting === 'SI',
        vatFilingPeriod: form.vatFilingPeriod,
        withholdingAgentResolution: form.withholdingAgentResolution.trim() || null,
        specialTaxpayerResolution: form.specialTaxpayerResolution.trim() || null,
      });
      await checkAuth();
      toast({ title: 'Perfil tributario guardado' });
      setEditing(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar el perfil tributario',
        description: apiErrorMessage(error, 'Inténtalo de nuevo.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const shown = editing ? form : fromCompany(company);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Perfil tributario</CardTitle>
          <CardDescription>
            Cómo te ve el SRI. Cambia lo que va en tus comprobantes y tus reportes.
          </CardDescription>
        </div>
        {isAdmin && !editing && (
          <Button variant="outlined" size="sm" onClick={startEditing}>
            <Edit />
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Régimen" htmlFor="taxRegime">
            <NativeSelect
              id="taxRegime"
              value={shown.taxRegime}
              onChange={(e) => set('taxRegime', e.target.value as TaxRegime)}
              disabled={!editing}
            >
              {Object.entries(TAX_REGIME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Declaras IVA" htmlFor="vatFilingPeriod">
            <NativeSelect
              id="vatFilingPeriod"
              value={shown.vatFilingPeriod}
              onChange={(e) => set('vatFilingPeriod', e.target.value as VatFilingPeriod)}
              disabled={!editing}
            >
              {Object.entries(VAT_FILING_PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Obligada a llevar contabilidad" htmlFor="keepsAccounting">
            <NativeSelect
              id="keepsAccounting"
              value={shown.keepsAccounting}
              onChange={(e) => set('keepsAccounting', e.target.value as Form['keepsAccounting'])}
              disabled={!editing}
            >
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </NativeSelect>
          </FormField>
          <FormField
            label="Agente de retención (resolución)"
            htmlFor="withholdingAgentResolution"
            error={errors.withholdingAgentResolution}
            hint={editing ? 'Solo el número. Vacío si no eres agente de retención.' : undefined}
          >
            <Input
              id="withholdingAgentResolution"
              inputMode="numeric"
              value={shown.withholdingAgentResolution}
              placeholder="No es agente"
              onChange={(e) => set('withholdingAgentResolution', e.target.value)}
              disabled={!editing}
            />
          </FormField>
          <FormField
            label="Contribuyente especial (resolución)"
            htmlFor="specialTaxpayerResolution"
            error={errors.specialTaxpayerResolution}
            hint={editing ? 'Vacío si no eres contribuyente especial.' : undefined}
          >
            <Input
              id="specialTaxpayerResolution"
              inputMode="numeric"
              value={shown.specialTaxpayerResolution}
              placeholder="No es contribuyente especial"
              onChange={(e) => set('specialTaxpayerResolution', e.target.value)}
              disabled={!editing}
            />
          </FormField>
        </div>

        <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Sale en el XML y el RIDE de lo que emitas desde ahora. Los comprobantes ya autorizados no
          cambian.
        </p>

        {editing && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outlined" onClick={() => setEditing(false)} disabled={saving}>
              <X />
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save />
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
