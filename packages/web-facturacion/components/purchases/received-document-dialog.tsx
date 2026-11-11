'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  SearchableSelect,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { SupplierDialog } from '@/components/suppliers/supplier-dialog';
import {
  formatDocumentNumber,
  ReceivedDocument,
  ReceivedDocumentInput,
  receivedDocumentsApi,
} from '@/lib/api/received-documents';
import { Supplier, SupplierInput } from '@/lib/api/suppliers';
import { ExpenseAccount } from '@/lib/api/expense-accounts';
import { useCreateSupplier, useSuppliers } from '@/lib/hooks/use-suppliers';
import { useExpenseAccounts } from '@/lib/hooks/use-expense-accounts';
import {
  CASH_PAYMENT_LIMIT,
  EXEMPT_CODE,
  NOT_SUBJECT_CODE,
  PAYMENT_METHODS,
  RECEIVED_DOCUMENT_TYPES,
  TAX_SUPPORT_CODES,
  TAXED_IVA_RATES,
  ZERO_RATE_CODE,
} from '@/lib/sri-catalogs';
import { formatCurrency } from '@/lib/utils/formatters';

interface ReceivedDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La compra que se edita; sin ella, se registra una nueva. */
  document?: ReceivedDocument | null;
  onSubmit: (data: ReceivedDocumentInput) => Promise<unknown>;
  saving?: boolean;
}

interface Form {
  supplierId: string;
  documentType: string;
  number: string;
  issueDate: string;
  authorizationNumber: string;
  taxedCode: string;
  taxedBase: string;
  iva: string;
  zeroBase: string;
  notSubjectBase: string;
  exemptBase: string;
  iceValue: string;
  otherCharges: string;
  total: string;
  paymentMethodCode: string;
  taxSupportCode: string;
  expenseAccountId: string;
  description: string;
}
type Errors = Partial<Record<keyof Form, string>>;

const NUMBER_PATTERN = /^\d{3}-\d{3}-\d{1,9}$/;

/** Fecha LOCAL del navegador (Ecuador), no toISOString(), que después de las 19:00 ya es mañana. */
function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const toNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : 0;
};
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const amountText = (value: number | string) => (Number(value) ? Number(value).toFixed(2) : '');

function emptyForm(): Form {
  return {
    supplierId: '',
    documentType: '01',
    number: '',
    issueDate: todayLocal(),
    authorizationNumber: '',
    taxedCode: '4',
    taxedBase: '',
    iva: '',
    zeroBase: '',
    notSubjectBase: '',
    exemptBase: '',
    iceValue: '',
    otherCharges: '',
    total: '',
    paymentMethodCode: '',
    taxSupportCode: '',
    expenseAccountId: '',
    description: '',
  };
}

function fromDocument(doc: ReceivedDocument): Form {
  const line = (code: string) => doc.taxes.find((tax) => tax.ivaCode === code);
  const taxed = doc.taxes.find((tax) => TAXED_IVA_RATES.some((rate) => rate.code === tax.ivaCode));
  return {
    supplierId: doc.supplier.id,
    documentType: doc.documentType,
    number: formatDocumentNumber(doc),
    issueDate: doc.issueDate.slice(0, 10),
    authorizationNumber: doc.authorizationNumber ?? '',
    taxedCode: taxed?.ivaCode ?? '4',
    taxedBase: amountText(taxed?.taxBase ?? 0),
    iva: amountText(taxed?.ivaValue ?? 0),
    zeroBase: amountText(line(ZERO_RATE_CODE)?.taxBase ?? 0),
    notSubjectBase: amountText(line(NOT_SUBJECT_CODE)?.taxBase ?? 0),
    exemptBase: amountText(line(EXEMPT_CODE)?.taxBase ?? 0),
    iceValue: amountText(doc.iceValue),
    otherCharges: amountText(doc.otherCharges),
    total: Number(doc.total).toFixed(2),
    paymentMethodCode: doc.paymentMethodCode ?? '',
    taxSupportCode: doc.taxSupportCode ?? '',
    expenseAccountId: doc.expenseAccount?.id ?? '',
    description: doc.description ?? '',
  };
}

const supplierLabel = (supplier: Supplier) => supplier.businessName;
const accountLabel = (account: Pick<ExpenseAccount, 'code' | 'name'>) =>
  account.code ? `${account.code} · ${account.name}` : account.name;

/** Registrar a mano o editar una compra: factura o nota de venta de un proveedor. */
export function ReceivedDocumentDialog({
  open,
  onOpenChange,
  document,
  onSubmit,
  saving,
}: ReceivedDocumentDialogProps) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: accounts = [] } = useExpenseAccounts();
  const createSupplier = useCreateSupplier();

  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  // IVA y total se calculan solos hasta que el usuario los escribe a mano.
  const [ivaTouched, setIvaTouched] = useState(false);
  const [totalTouched, setTotalTouched] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const editing = !!document;
  const lockedAmounts = !!document && document.source !== 'MANUAL';

  useEffect(() => {
    if (!open) return;
    setForm(document ? fromDocument(document) : emptyForm());
    setIvaTouched(!!document);
    setTotalTouched(!!document);
    setSuggested(false);
    setErrors({});
  }, [open, document]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const isSaleNote = form.documentType === '02';
  const rate = TAXED_IVA_RATES.find((r) => r.code === form.taxedCode) ?? TAXED_IVA_RATES[0];
  const taxedBase = isSaleNote ? 0 : toNumber(form.taxedBase);
  const ice = isSaleNote ? 0 : toNumber(form.iceValue);
  // El ICE forma parte de la base del IVA.
  const expectedIva = round2(((taxedBase + ice) * rate.percentage) / 100);
  const iva = isSaleNote ? 0 : ivaTouched ? toNumber(form.iva) : expectedIva;
  const computedTotal = round2(
    taxedBase +
      ice +
      iva +
      toNumber(form.zeroBase) +
      toNumber(form.notSubjectBase) +
      toNumber(form.exemptBase) +
      toNumber(form.otherCharges),
  );
  const total = totalTouched ? toNumber(form.total) : computedTotal;
  const ivaOff = ivaTouched && taxedBase > 0 && Math.abs(iva - expectedIva) > 0.02;
  const cashOverLimit = form.paymentMethodCode === '01' && total > CASH_PAYMENT_LIMIT;

  // Las inactivas no se ofrecen, salvo la que ya tiene la compra que se edita.
  const accountOptions = useMemo(() => {
    const current = document?.expenseAccount;
    return current && !current.isActive ? [...accounts, current] : accounts;
  }, [accounts, document]);

  const chooseSupplier = async (supplierId: string) => {
    set('supplierId', supplierId);
    if (editing || !supplierId) return;
    try {
      const suggestion = await receivedDocumentsApi.suggestion(supplierId);
      let used = false;
      setForm((current) => {
        const next = { ...current };
        if (!next.expenseAccountId && suggestion.expenseAccountId) {
          next.expenseAccountId = suggestion.expenseAccountId;
          used = true;
        }
        if (!next.taxSupportCode && suggestion.taxSupportCode) {
          next.taxSupportCode = suggestion.taxSupportCode;
        }
        if (!next.paymentMethodCode && suggestion.paymentMethodCode) {
          next.paymentMethodCode = suggestion.paymentMethodCode;
        }
        return next;
      });
      setSuggested(used);
    } catch {
      // Sin sugerencia no pasa nada: el usuario elige.
    }
  };

  const createNewSupplier = async (data: SupplierInput) => {
    const supplier = (await createSupplier.mutateAsync(data)) as Supplier;
    await chooseSupplier(supplier.id);
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (!form.supplierId) found.supplierId = 'Elige el proveedor';
    if (!NUMBER_PATTERN.test(form.number.trim())) {
      found.number = 'Escribe el número como 001-001-000000123';
    }
    if (!form.issueDate) found.issueDate = 'La fecha es obligatoria';
    else if (form.issueDate > todayLocal()) found.issueDate = 'La fecha no puede ser futura';
    const authorization = form.authorizationNumber.trim();
    if (authorization) {
      if (isSaleNote && !/^\d{10}$/.test(authorization)) {
        found.authorizationNumber = 'La nota de venta es preimpresa: 10 dígitos de la imprenta';
      } else if (!isSaleNote && !/^(\d{10}|\d{37}|\d{49})$/.test(authorization)) {
        found.authorizationNumber = '10 dígitos (imprenta), 37 (electrónica anterior) o 49 (clave)';
      }
    }
    if (total <= 0) found.total = 'El total debe ser mayor a cero';
    else if (Math.abs(total - computedTotal) > 0.01) {
      found.total = `No cuadra: los valores de arriba suman ${formatCurrency(computedTotal)}`;
    }
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const taxes = [
      ...(isSaleNote ? [] : [{ ivaCode: form.taxedCode, taxBase: taxedBase, ivaValue: iva }]),
      { ivaCode: ZERO_RATE_CODE, taxBase: toNumber(form.zeroBase), ivaValue: 0 },
      { ivaCode: NOT_SUBJECT_CODE, taxBase: toNumber(form.notSubjectBase), ivaValue: 0 },
      { ivaCode: EXEMPT_CODE, taxBase: toNumber(form.exemptBase), ivaValue: 0 },
    ].filter((line) => line.taxBase > 0 || line.ivaValue > 0);

    const common = {
      paymentMethodCode: form.paymentMethodCode || null,
      taxSupportCode: form.taxSupportCode || null,
      expenseAccountId: form.expenseAccountId || null,
      description: form.description.trim() || null,
    };
    const data: ReceivedDocumentInput = lockedAmounts
      ? (common as ReceivedDocumentInput)
      : {
          ...common,
          supplierId: form.supplierId,
          documentType: form.documentType,
          number: form.number.trim(),
          issueDate: form.issueDate,
          authorizationNumber: form.authorizationNumber.trim() || null,
          taxes,
          iceValue: ice,
          otherCharges: toNumber(form.otherCharges),
          total: round2(total),
        };
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch {
      // El hook ya mostró el error de la API; el diálogo queda abierto para corregir.
    }
  };

  const amountInput = (key: keyof Form, id: string, placeholder = '0.00') => (
    <Input
      id={id}
      value={form[key]}
      inputMode="decimal"
      placeholder={placeholder}
      disabled={lockedAmounts}
      className="text-right"
      onChange={(e) => set(key, e.target.value)}
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <form onSubmit={submit} className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar compra' : 'Registrar compra'}</DialogTitle>
              <DialogDescription>
                Copia los datos del comprobante que te dio el proveedor.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-6">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Proveedor *"
                  htmlFor="purchase-supplier"
                  error={errors.supplierId}
                  className="sm:col-span-2"
                >
                  <SearchableSelect
                    id="purchase-supplier"
                    items={suppliers}
                    value={form.supplierId}
                    onChange={chooseSupplier}
                    getId={(supplier) => supplier.id}
                    getLabel={supplierLabel}
                    getSubLabel={(supplier) => supplier.identification}
                    placeholder="Elige el proveedor"
                    searchPlaceholder="Buscar por nombre o RUC…"
                    emptyMessage="Ningún proveedor coincide"
                    onAddNew={lockedAmounts ? undefined : () => setSupplierDialogOpen(true)}
                    addNewLabel="Nuevo proveedor"
                    disabled={lockedAmounts}
                    error={!!errors.supplierId}
                  />
                </FormField>
                <FormField label="Comprobante *" htmlFor="purchase-type">
                  <NativeSelect
                    id="purchase-type"
                    value={form.documentType}
                    disabled={lockedAmounts}
                    onChange={(e) => set('documentType', e.target.value)}
                  >
                    {Object.entries(RECEIVED_DOCUMENT_TYPES).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Número *" htmlFor="purchase-number" error={errors.number}>
                  <Input
                    id="purchase-number"
                    value={form.number}
                    placeholder="001-001-000000123"
                    inputMode="numeric"
                    maxLength={17}
                    disabled={lockedAmounts}
                    onChange={(e) => set('number', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Fecha de emisión *"
                  htmlFor="purchase-date"
                  error={errors.issueDate}
                >
                  <Input
                    id="purchase-date"
                    type="date"
                    value={form.issueDate}
                    max={todayLocal()}
                    disabled={lockedAmounts}
                    onChange={(e) => set('issueDate', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Autorización"
                  htmlFor="purchase-authorization"
                  error={errors.authorizationNumber}
                  hint={
                    isSaleNote
                      ? 'La de la imprenta: 10 dígitos'
                      : 'De la imprenta (10 dígitos) o la clave de acceso (49)'
                  }
                >
                  <Input
                    id="purchase-authorization"
                    value={form.authorizationNumber}
                    inputMode="numeric"
                    maxLength={49}
                    placeholder="Opcional"
                    disabled={lockedAmounts}
                    onChange={(e) => set('authorizationNumber', e.target.value)}
                  />
                </FormField>
              </section>

              <section className="space-y-3">
                <h3 className="text-title-sm text-on-surface">Valores</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {!isSaleNote && (
                    <>
                      <FormField label="Base con IVA" htmlFor="purchase-taxed">
                        <div className="flex gap-2">
                          <NativeSelect
                            aria-label="Tarifa de IVA"
                            value={form.taxedCode}
                            disabled={lockedAmounts}
                            className="w-24 shrink-0"
                            onChange={(e) => set('taxedCode', e.target.value)}
                          >
                            {TAXED_IVA_RATES.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </NativeSelect>
                          {amountInput('taxedBase', 'purchase-taxed')}
                        </div>
                      </FormField>
                      <FormField
                        label="IVA"
                        htmlFor="purchase-iva"
                        hint={
                          ivaOff
                            ? `Con ${rate.label} daría ${formatCurrency(expectedIva)}: revisa si el comprobante dice otra cosa`
                            : ivaTouched
                              ? undefined
                              : 'Calculado; cámbialo si el comprobante dice otro valor'
                        }
                      >
                        <Input
                          id="purchase-iva"
                          value={ivaTouched ? form.iva : amountText(expectedIva)}
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={lockedAmounts}
                          className="text-right"
                          onChange={(e) => {
                            setIvaTouched(true);
                            set('iva', e.target.value);
                          }}
                        />
                      </FormField>
                    </>
                  )}
                  <FormField
                    label={isSaleNote ? 'Valor de la nota de venta' : 'Base 0 %'}
                    htmlFor="purchase-zero"
                  >
                    {amountInput('zeroBase', 'purchase-zero')}
                  </FormField>
                  <FormField label="No objeto de IVA" htmlFor="purchase-not-subject">
                    {amountInput('notSubjectBase', 'purchase-not-subject')}
                  </FormField>
                  <FormField label="Exento de IVA" htmlFor="purchase-exempt">
                    {amountInput('exemptBase', 'purchase-exempt')}
                  </FormField>
                  {!isSaleNote && (
                    <FormField label="ICE" htmlFor="purchase-ice" hint="Bebidas, cigarrillos…">
                      {amountInput('iceValue', 'purchase-ice')}
                    </FormField>
                  )}
                  <FormField label="Otros valores" htmlFor="purchase-other" hint="Propina u otros">
                    {amountInput('otherCharges', 'purchase-other')}
                  </FormField>
                  <FormField
                    label="Total del comprobante *"
                    htmlFor="purchase-total"
                    error={errors.total}
                    className="sm:col-start-3"
                  >
                    <Input
                      id="purchase-total"
                      value={totalTouched ? form.total : amountText(computedTotal)}
                      inputMode="decimal"
                      placeholder="0.00"
                      disabled={lockedAmounts}
                      className="text-right text-title-md"
                      onChange={(e) => {
                        setTotalTouched(true);
                        set('total', e.target.value);
                      }}
                    />
                  </FormField>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Forma de pago" htmlFor="purchase-payment">
                  <NativeSelect
                    id="purchase-payment"
                    value={form.paymentMethodCode}
                    onChange={(e) => set('paymentMethodCode', e.target.value)}
                  >
                    <option value="">Sin especificar</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  label="Cuenta de gasto"
                  htmlFor="purchase-account"
                  hint={suggested ? 'La de la última compra a este proveedor' : undefined}
                >
                  <NativeSelect
                    id="purchase-account"
                    value={form.expenseAccountId}
                    onChange={(e) => {
                      setSuggested(false);
                      set('expenseAccountId', e.target.value);
                    }}
                  >
                    <option value="">Sin cuenta (asignar después)</option>
                    {accountOptions.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                        {account.isActive ? '' : ' (inactiva)'}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                {cashOverLimit && (
                  <Alert variant="warning" className="sm:col-span-2">
                    <AlertDescription>
                      Una compra de más de {formatCurrency(CASH_PAYMENT_LIMIT)} pagada en efectivo
                      no es deducible ni da crédito tributario de IVA. Si la pagaste por el banco,
                      elige esa forma de pago.
                    </AlertDescription>
                  </Alert>
                )}
                <FormField
                  label="Sustento tributario"
                  htmlFor="purchase-support"
                  hint="Para el ATS; tu contador te dice cuál usar"
                  className="sm:col-span-2"
                >
                  <NativeSelect
                    id="purchase-support"
                    value={form.taxSupportCode}
                    onChange={(e) => set('taxSupportCode', e.target.value)}
                  >
                    <option value="">Sin especificar</option>
                    {Object.entries(TAX_SUPPORT_CODES).map(([code, label]) => (
                      <option key={code} value={code}>
                        {code} · {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Nota" htmlFor="purchase-description" className="sm:col-span-2">
                  <Input
                    id="purchase-description"
                    value={form.description}
                    maxLength={300}
                    placeholder="Opcional: qué compraste"
                    onChange={(e) => set('description', e.target.value)}
                  />
                </FormField>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outlined" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSubmit={createNewSupplier}
        saving={createSupplier.isPending}
      />
    </>
  );
}
