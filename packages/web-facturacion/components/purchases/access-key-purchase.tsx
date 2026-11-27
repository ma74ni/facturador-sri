'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  History,
  Info,
  ScanLine,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  DialogBody,
  DialogFooter,
  FormField,
  IconButton,
  Input,
  NativeSelect,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { AccessKeyScanner, canScanBarcodes } from '@/components/purchases/access-key-scanner';
import {
  AccessKeyPreview,
  formatDocumentNumber,
  ReceivedDocument,
} from '@/lib/api/received-documents';
import { useExpenseAccounts } from '@/lib/hooks/use-expense-accounts';
import { useAccessKeyLookup, useRegisterFromAccessKey } from '@/lib/hooks/use-received-documents';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
import {
  CASH_PAYMENT_LIMIT,
  PAYMENT_METHODS,
  TAX_SUPPORT_CODES,
  TAXED_IVA_RATES,
} from '@/lib/sri-catalogs';
import { formatCurrency } from '@/lib/utils/formatters';

interface AccessKeyPurchaseProps {
  /** Registrada (o ya lo estaba): se cierra el diálogo. */
  onDone: () => void;
  onCancel: () => void;
  /** Pasar al registro manual (el SRI no la tiene o no responde). */
  onManual: () => void;
  /** Abrir la compra que ya estaba registrada con esa clave. */
  onShowExisting: (document: ReceivedDocument) => void;
}

type Problem = { kind: 'key' | 'blocked' | 'retry' | 'manual'; message: string };

const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** Módulo 11 de la ficha técnica: un dígito mal copiado se avisa antes de ir al servidor. */
function checkDigitOk(key: string): boolean {
  let sum = 0;
  let factor = 2;
  for (let i = 47; i >= 0; i--) {
    sum += Number(key[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const check = 11 - (sum % 11);
  return String(check === 11 ? 0 : check === 10 ? 1 : check) === key[48];
}

const formatDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  }).format(new Date(iso));

function rateLabel(ivaCode: string, ivaRate: number) {
  if (ivaCode === '0') return 'Base 0 %';
  if (ivaCode === '6') return 'No objeto de IVA';
  if (ivaCode === '7') return 'Exento de IVA';
  return `Base IVA ${TAXED_IVA_RATES.find((r) => r.code === ivaCode)?.percentage ?? ivaRate} %`;
}

/** Camino "con clave de acceso" de Registrar compra: pegar → vista previa del SRI → registrar. */
export function AccessKeyPurchase({
  onDone,
  onCancel,
  onManual,
  onShowExisting,
}: AccessKeyPurchaseProps) {
  const lookup = useAccessKeyLookup();
  const register = useRegisterFromAccessKey();
  const { data: accounts = [] } = useExpenseAccounts();

  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [existing, setExisting] = useState<ReceivedDocument | null>(null);
  const [preview, setPreview] = useState<AccessKeyPreview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanAvailable, setScanAvailable] = useState(false);
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [taxSupportCode, setTaxSupportCode] = useState('');
  const [description, setDescription] = useState('');

  // Se decide en el navegador: en el servidor no hay cámara que consultar.
  useEffect(() => setScanAvailable(canScanBarcodes()), []);

  const digits = onlyDigits(input);

  const consult = async (raw = input) => {
    const key = onlyDigits(raw);
    setExisting(null);
    if (key.length !== 49) {
      setProblem({
        kind: 'key',
        message: `La clave de acceso tiene 49 dígitos y esta tiene ${key.length}`,
      });
      return;
    }
    if (!checkDigitOk(key)) {
      setProblem({
        kind: 'key',
        message: 'El último dígito no cuadra: revisa si copiaste bien la clave',
      });
      return;
    }
    setProblem(null);
    try {
      const result = await lookup.mutateAsync(key);
      if (result.alreadyRegistered) {
        setExisting(result.document);
        return;
      }
      setPreview(result);
      setPaymentMethodCode(result.paymentMethodCode ?? result.suggestion.paymentMethodCode ?? '');
      setExpenseAccountId(result.suggestion.expenseAccountId ?? '');
      setTaxSupportCode(result.suggestion.taxSupportCode ?? '');
      setDescription('');
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = apiErrorMessage(error, 'No se pudo consultar la clave en el SRI');
      setProblem({
        // 400: la clave en sí; factura de más de 2 meses: solo a mano; SRI caído, en proceso, sin la
        // clave o demasiadas consultas: se reintenta o se registra a mano.
        kind:
          status === 400
            ? 'key'
            : message.includes('últimos 2 meses')
              ? 'manual'
              : status === 503 ||
                  status === 429 ||
                  message.includes('no tiene autorizada') ||
                  message.includes('todavía está procesando')
                ? 'retry'
                : 'blocked',
        message,
      });
    }
  };

  const scanned = useCallback((key: string) => {
    setScanning(false);
    setInput(key);
    void consult(key);
    // consult solo lee estado que ya se reinicia; no hace falta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) {
      await consult();
      return;
    }
    try {
      await register.mutateAsync({
        accessKey: preview.accessKey,
        paymentMethodCode: paymentMethodCode || null,
        expenseAccountId: expenseAccountId || null,
        taxSupportCode: taxSupportCode || null,
        description: description.trim() || null,
      });
      onDone();
    } catch {
      // El hook ya mostró el error; el diálogo queda abierto para reintentar.
    }
  };

  const back = () => {
    setPreview(null);
    setProblem(null);
  };

  const cashOverLimit =
    !!preview && paymentMethodCode === '01' && preview.total > CASH_PAYMENT_LIMIT;

  return (
    <form onSubmit={submit} className="contents">
      <DialogBody className="space-y-5">
        {!preview ? (
          <>
            <FormField
              label="Clave de acceso *"
              htmlFor="purchase-access-key"
              error={problem?.kind === 'key' ? problem.message : undefined}
              hint={
                <span className="flex justify-between gap-2">
                  <span>
                    Está debajo del código de barras del RIDE, o en el correo del proveedor
                  </span>
                  <span className="shrink-0 tabular-nums">{digits.length} / 49</span>
                </span>
              }
            >
              <div className="flex gap-2">
                <Input
                  id="purchase-access-key"
                  value={input}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="49 dígitos"
                  className="font-mono"
                  onChange={(e) => {
                    setInput(e.target.value);
                    setProblem(null);
                    setExisting(null);
                  }}
                />
                {scanAvailable && (
                  <IconButton
                    type="button"
                    label="Escanear el código de barras"
                    onClick={() => setScanning((value) => !value)}
                  >
                    <ScanLine />
                  </IconButton>
                )}
              </div>
            </FormField>

            {scanning && (
              <AccessKeyScanner onDetected={scanned} onClose={() => setScanning(false)} />
            )}

            {existing && (
              <Alert variant="info">
                <Info />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Ya registraste esta factura ({formatDocumentNumber(existing)} de{' '}
                    {existing.supplier.businessName})
                    {existing.status === 'VOIDED' ? ', y está descartada.' : '.'}
                  </span>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={() => onShowExisting(existing)}
                  >
                    Ver compra
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {problem?.kind === 'blocked' && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{problem.message}</AlertDescription>
              </Alert>
            )}
            {(problem?.kind === 'retry' || problem?.kind === 'manual') && (
              <Alert variant="warning">
                {problem.kind === 'manual' ? <History /> : <CloudOff />}
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>{problem.message}</span>
                  <Button type="button" variant="text" size="sm" onClick={onManual}>
                    Registrar a mano
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <>
            <section className="space-y-3 rounded-lg bg-surface-container-low p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-title-md text-on-surface">{preview.supplier.businessName}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    RUC {preview.supplier.identification}
                    {!preview.supplier.id && (
                      <Badge variant="info" className="ml-2">
                        Proveedor nuevo: se crea al registrar
                      </Badge>
                    )}
                  </p>
                </div>
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Autorizada
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-body-md sm:grid-cols-3">
                <div>
                  <dt className="text-label-md text-on-surface-variant">Factura</dt>
                  <dd className="tabular-nums">{preview.number}</dd>
                </div>
                <div>
                  <dt className="text-label-md text-on-surface-variant">Emisión</dt>
                  <dd>{formatDate(preview.issueDate)}</dd>
                </div>
                {preview.authorizationDate && (
                  <div>
                    <dt className="text-label-md text-on-surface-variant">Autorizada el</dt>
                    <dd>{formatDateTime(preview.authorizationDate)}</dd>
                  </div>
                )}
              </dl>
              <dl className="space-y-1 border-t border-outline-variant pt-3 text-body-md">
                {preview.taxes.map((tax) => (
                  <div key={tax.ivaCode} className="flex justify-between">
                    <dt>{rateLabel(tax.ivaCode, tax.ivaRate)}</dt>
                    <dd className="tabular-nums">{formatCurrency(tax.taxBase)}</dd>
                  </div>
                ))}
                {preview.totalDiscount > 0 && (
                  <div className="flex justify-between text-on-surface-variant">
                    <dt>Descuento (ya restado)</dt>
                    <dd className="tabular-nums">{formatCurrency(preview.totalDiscount)}</dd>
                  </div>
                )}
                {preview.iceValue > 0 && (
                  <div className="flex justify-between">
                    <dt>ICE</dt>
                    <dd className="tabular-nums">{formatCurrency(preview.iceValue)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>IVA</dt>
                  <dd className="tabular-nums">{formatCurrency(preview.ivaValue)}</dd>
                </div>
                {preview.otherCharges > 0 && (
                  <div className="flex justify-between">
                    <dt>Propina u otros</dt>
                    <dd className="tabular-nums">{formatCurrency(preview.otherCharges)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-title-md text-on-surface">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(preview.total)}</dd>
                </div>
              </dl>
              {preview.itemCount > 0 && (
                <details className="text-body-sm text-on-surface-variant">
                  <summary className="cursor-pointer text-label-lg text-primary">
                    {preview.itemCount === 1 ? '1 producto' : `${preview.itemCount} productos`} ·
                    Ver detalle
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {preview.items.map((item, index) => (
                      <li key={index} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">
                          {Number(item.quantity)} × {item.description}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(item.total)}</span>
                      </li>
                    ))}
                    {preview.itemCount > preview.items.length && (
                      <li>Y {preview.itemCount - preview.items.length} más en el XML.</li>
                    )}
                  </ul>
                </details>
              )}
            </section>

            {preview.warnings.length > 0 && (
              <Alert variant="warning">
                <AlertCircle />
                <AlertDescription>
                  Revisa con el RIDE: {preview.warnings.join('. ')}.
                </AlertDescription>
              </Alert>
            )}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Forma de pago"
                htmlFor="key-payment"
                hint={
                  preview.paymentMethodCode && paymentMethodCode === preview.paymentMethodCode
                    ? 'La que trae la factura'
                    : undefined
                }
              >
                <NativeSelect
                  id="key-payment"
                  value={paymentMethodCode}
                  onChange={(e) => setPaymentMethodCode(e.target.value)}
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
                htmlFor="key-account"
                hint={
                  expenseAccountId && expenseAccountId === preview.suggestion.expenseAccountId
                    ? 'La de la última compra a este proveedor'
                    : 'Sin cuenta si la dejas vacía'
                }
              >
                <NativeSelect
                  id="key-account"
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                >
                  <option value="">Sin cuenta (asignar después)</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code ? `${account.code} · ${account.name}` : account.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              {cashOverLimit && (
                <Alert variant="warning" className="sm:col-span-2">
                  <AlertDescription>
                    Una compra de más de {formatCurrency(CASH_PAYMENT_LIMIT)} pagada en efectivo no
                    es deducible ni da crédito tributario de IVA. Si la pagaste por el banco, elige
                    esa forma de pago.
                  </AlertDescription>
                </Alert>
              )}
              <FormField
                label="Sustento tributario"
                htmlFor="key-support"
                hint="Para el ATS; tu contador te dice cuál usar"
                className="sm:col-span-2"
              >
                <NativeSelect
                  id="key-support"
                  value={taxSupportCode}
                  onChange={(e) => setTaxSupportCode(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(TAX_SUPPORT_CODES).map(([code, label]) => (
                    <option key={code} value={code}>
                      {code} · {label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Nota" htmlFor="key-description" className="sm:col-span-2">
                <Input
                  id="key-description"
                  value={description}
                  maxLength={300}
                  placeholder="Opcional: qué compraste"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>
            </section>
          </>
        )}
      </DialogBody>
      <DialogFooter className={preview ? 'sm:justify-between' : undefined}>
        {preview && (
          <Button type="button" variant="text" onClick={back}>
            <ArrowLeft />
            Usar otra clave
          </Button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outlined" onClick={onCancel}>
            Cancelar
          </Button>
          {preview ? (
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Registrando…' : 'Registrar'}
            </Button>
          ) : (
            <Button type="submit" disabled={lookup.isPending || digits.length === 0}>
              {lookup.isPending ? 'Consultando…' : 'Consultar en el SRI'}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}
