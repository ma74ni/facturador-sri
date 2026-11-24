'use client';

import { useMemo, useState } from 'react';
import { Ban, Edit, FolderOpen, Loader2, Plus, Receipt, ShoppingCart } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  FilterBar,
  FormField,
  IconButton,
  Input,
  NativeSelect,
  Pagination,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReceivedDocumentDialog } from '@/components/purchases/received-document-dialog';
import {
  formatDocumentNumber,
  ReceivedDocument,
  ReceivedDocumentInput,
} from '@/lib/api/received-documents';
import {
  useAssignExpenseAccount,
  useCreateReceivedDocument,
  useReceivedDocuments,
  useUpdateReceivedDocument,
  useVoidReceivedDocument,
} from '@/lib/hooks/use-received-documents';
import { useExpenseAccounts } from '@/lib/hooks/use-expense-accounts';
import { usePagination } from '@/lib/hooks/use-pagination';
import { RECEIVED_DOCUMENT_TYPES } from '@/lib/sri-catalogs';
import { formatCurrency } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

/** La fecha de emisión se guarda a medianoche UTC: se muestra tal cual, sin pasar por la zona local. */
const formatIssueDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const monthLabel = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es-EC', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
  return `${label} ${year}`;
};

function AccountCell({ document }: { document: ReceivedDocument }) {
  if (!document.expenseAccount) {
    return document.status === 'VOIDED' ? (
      <span className="text-on-surface-variant">—</span>
    ) : (
      <Badge variant="warning">Sin cuenta</Badge>
    );
  }
  const { code, name } = document.expenseAccount;
  return (
    <span className="text-body-sm">
      {code && <span className="font-mono text-on-surface-variant">{code} </span>}
      {name}
    </span>
  );
}

/** Compras de la empresa (módulo Compras): lista del mes, registro manual y cuentas de gasto. */
export default function ComprasPage() {
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState('');
  const [withoutAccount, setWithoutAccount] = useState(false);
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ month, type, withoutAccount }), [month, type, withoutAccount]);

  const { data, isLoading, isFetching } = useReceivedDocuments(filters);
  const { data: accounts = [] } = useExpenseAccounts();
  const create = useCreateReceivedDocument();
  const update = useUpdateReceivedDocument();
  const voidDocument = useVoidReceivedDocument();
  const assign = useAssignExpenseAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReceivedDocument | null>(null);
  const [toVoid, setToVoid] = useState<ReceivedDocument | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAccount, setBulkAccount] = useState('');

  const documents = useMemo(() => data?.documents ?? [], [data]);
  // La búsqueda filtra en el navegador lo que ya trajo el mes: es inmediata.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      [
        doc.supplier.businessName,
        doc.supplier.identification,
        formatDocumentNumber(doc),
        doc.description ?? '',
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [documents, search]);
  const pagination = usePagination(filtered, 15, `${search}|${month}|${type}|${withoutAccount}`);

  const selectable = filtered.filter((doc) => doc.status !== 'VOIDED');
  const pageSelectable = pagination.pageItems.filter((doc) => doc.status !== 'VOIDED');
  const allPageSelected =
    pageSelectable.length > 0 && pageSelectable.every((doc) => selected.has(doc.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const doc of pageSelectable) {
        if (allPageSelected) next.delete(doc.id);
        else next.add(doc.id);
      }
      return next;
    });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (doc: ReceivedDocument) => {
    setEditing(doc);
    setDialogOpen(true);
  };
  const save = (input: ReceivedDocumentInput) =>
    editing ? update.mutateAsync({ id: editing.id, data: input }) : create.mutateAsync(input);

  const confirmVoid = async () => {
    if (!toVoid || voidReason.trim().length < 3) return;
    try {
      await voidDocument.mutateAsync({ id: toVoid.id, reason: voidReason.trim() });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(toVoid.id);
        return next;
      });
      setToVoid(null);
    } catch {
      // El hook ya mostró el error.
    }
  };

  const applyBulk = async () => {
    if (selected.size === 0 || !bulkAccount) return;
    try {
      await assign.mutateAsync({
        ids: [...selected],
        expenseAccountId: bulkAccount === 'none' ? null : bulkAccount,
      });
      setSelected(new Set());
      setBulkAccount('');
    } catch {
      // El hook ya mostró el error.
    }
  };

  const summary = data?.summary;
  const activeFilters = (type ? 1 : 0) + (withoutAccount ? 1 : 0);

  const actions = (doc: ReceivedDocument) =>
    doc.status === 'VOIDED' ? null : (
      <div className="flex items-center justify-end gap-1">
        <IconButton label="Editar compra" onClick={() => openEdit(doc)}>
          <Edit />
        </IconButton>
        <IconButton
          label="Descartar compra"
          tone="destructive"
          onClick={() => {
            setVoidReason('');
            setToVoid(doc);
          }}
        >
          <Ban />
        </IconButton>
      </div>
    );

  const selectBox = (doc: ReceivedDocument) =>
    doc.status === 'VOIDED' ? null : (
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        aria-label={`Seleccionar ${formatDocumentNumber(doc)}`}
        checked={selected.has(doc.id)}
        onChange={() => toggle(doc.id)}
      />
    );

  const voidedNote = (doc: ReceivedDocument) =>
    doc.status === 'VOIDED' && (
      <span className="block text-body-sm text-on-surface-variant">
        <Badge variant="secondary" className="mr-1">
          Descartada
        </Badge>
        {doc.voidReason}
      </span>
    );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Compras</h1>
          <p className="text-body-md text-on-surface-variant">
            Lo que te facturaron tus proveedores, para tus reportes al SRI
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus />
          Registrar compra
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={`Compras de ${monthLabel(month)}`}
          value={formatCurrency(summary?.total)}
          description={`${summary?.registered ?? 0} comprobantes registrados`}
          icon={ShoppingCart}
        />
        <StatCard
          title="IVA en compras"
          value={formatCurrency(summary?.ivaValue)}
          description={`Sobre bases de ${formatCurrency(summary?.subtotal)}`}
          icon={Receipt}
        />
        <button
          type="button"
          className="text-left"
          aria-pressed={withoutAccount}
          onClick={() => setWithoutAccount((value) => !value)}
        >
          <StatCard
            title="Sin cuenta de gasto"
            value={summary?.withoutAccount ?? 0}
            description={withoutAccount ? 'Mostrando solo estas' : 'Toca para ver solo estas'}
            icon={FolderOpen}
            tone={summary?.withoutAccount ? 'warning' : undefined}
            className={cn(withoutAccount && 'ring-2 ring-primary')}
          />
        </button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar proveedor, RUC o número…"
            activeCount={activeFilters}
            onClear={() => {
              setType('');
              setWithoutAccount(false);
            }}
          >
            <FormField label="Mes" htmlFor="purchases-month">
              <Input
                id="purchases-month"
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </FormField>
            <FormField label="Comprobante" htmlFor="purchases-type">
              <NativeSelect
                id="purchases-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(RECEIVED_DOCUMENT_TYPES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <label className="flex items-center gap-2 self-end pb-2 text-body-md text-on-surface">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={withoutAccount}
                onChange={(e) => setWithoutAccount(e.target.checked)}
              />
              Solo sin cuenta
            </label>
          </FilterBar>

          {selected.size > 0 && (
            <div
              role="region"
              aria-label="Acciones sobre las compras seleccionadas"
              className="flex flex-col gap-3 rounded-lg bg-secondary-container p-3 text-on-secondary-container sm:flex-row sm:items-center"
            >
              <span className="text-label-lg">
                {selected.size === 1
                  ? '1 compra seleccionada'
                  : `${selected.size} compras seleccionadas`}
              </span>
              <NativeSelect
                aria-label="Cuenta de gasto para las seleccionadas"
                value={bulkAccount}
                className="sm:w-72"
                onChange={(e) => setBulkAccount(e.target.value)}
              >
                <option value="">Elige la cuenta…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code ? `${account.code} · ${account.name}` : account.name}
                  </option>
                ))}
                <option value="none">Quitar la cuenta</option>
              </NativeSelect>
              <div className="flex gap-2 sm:ml-auto">
                <Button variant="outlined" onClick={() => setSelected(new Set())}>
                  Cancelar
                </Button>
                <Button onClick={applyBulk} disabled={!bulkAccount || assign.isPending}>
                  {assign.isPending ? 'Asignando…' : 'Asignar cuenta'}
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-title-md text-on-surface">
                {documents.length === 0 && !activeFilters
                  ? `Sin compras en ${monthLabel(month)}`
                  : 'Sin resultados'}
              </p>
              <p className="mb-4 max-w-md text-body-md text-on-surface-variant">
                {documents.length === 0 && !activeFilters
                  ? 'Registra las facturas y notas de venta que te dieron tus proveedores este mes.'
                  : 'Ninguna compra coincide con los filtros.'}
              </p>
              {documents.length === 0 && !activeFilters ? (
                <Button onClick={openCreate}>
                  <Plus />
                  Registrar compra
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearch('');
                    setType('');
                    setWithoutAccount(false);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className={cn('space-y-4', isFetching && 'opacity-70')}>
              <div className="space-y-3 md:hidden">
                {pagination.pageItems.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      'space-y-2 rounded-lg border border-outline-variant p-4',
                      doc.status === 'VOIDED' && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-3">
                        <div className="pt-1">{selectBox(doc)}</div>
                        <div className="min-w-0 space-y-1">
                          <p className="break-words text-title-sm text-on-surface">
                            {doc.supplier.businessName}
                          </p>
                          <p className="text-body-sm text-on-surface-variant">
                            {RECEIVED_DOCUMENT_TYPES[doc.documentType]} {formatDocumentNumber(doc)}{' '}
                            · {formatIssueDate(doc.issueDate)}
                          </p>
                          {voidedNote(doc)}
                        </div>
                      </div>
                      {actions(doc)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <AccountCell document={doc} />
                      <span
                        className={cn('text-title-sm', doc.status === 'VOIDED' && 'line-through')}
                      >
                        {formatCurrency(doc.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        {pageSelectable.length > 0 && (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            aria-label="Seleccionar las compras de esta página"
                            checked={allPageSelected}
                            onChange={togglePage}
                          />
                        )}
                      </TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Cuenta de gasto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((doc) => {
                      const voided = doc.status === 'VOIDED';
                      return (
                        <TableRow key={doc.id} className={cn(voided && 'opacity-60')}>
                          <TableCell>{selectBox(doc)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatIssueDate(doc.issueDate)}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <p className="text-title-sm text-on-surface">
                              {doc.supplier.businessName}
                            </p>
                            <p className="font-mono text-body-sm text-on-surface-variant">
                              {doc.supplier.identification}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <p className="text-body-sm text-on-surface-variant">
                              {RECEIVED_DOCUMENT_TYPES[doc.documentType]}
                            </p>
                            <p className="font-mono text-body-sm">{formatDocumentNumber(doc)}</p>
                            {voidedNote(doc)}
                          </TableCell>
                          <TableCell className={cn('text-right', voided && 'line-through')}>
                            {formatCurrency(doc.subtotal)}
                          </TableCell>
                          <TableCell className={cn('text-right', voided && 'line-through')}>
                            {formatCurrency(doc.ivaValue)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right text-title-sm', voided && 'line-through')}
                          >
                            {formatCurrency(doc.total)}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <AccountCell document={doc} />
                          </TableCell>
                          <TableCell>{actions(doc)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Pagination {...pagination} onPageChange={pagination.setPage} />
              {selectable.length > pageSelectable.length && selected.size > 0 && (
                <p className="text-body-sm text-on-surface-variant">
                  La selección se mantiene al cambiar de página.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ReceivedDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        document={editing}
        onSubmit={save}
        saving={create.isPending || update.isPending}
      />

      <AlertDialog open={!!toVoid} onOpenChange={(open) => !open && setToVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              {toVoid && (
                <>
                  {RECEIVED_DOCUMENT_TYPES[toVoid.documentType]} {formatDocumentNumber(toVoid)} de{' '}
                  <strong>{toVoid.supplier.businessName}</strong> por {formatCurrency(toVoid.total)}
                  . No se borra: queda en la lista, pero deja de contar en tus reportes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField label="Motivo *" htmlFor="void-reason">
            <Textarea
              id="void-reason"
              rows={2}
              value={voidReason}
              maxLength={300}
              placeholder="Por ejemplo: registrada dos veces"
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              className="bg-error text-on-error"
              disabled={voidReason.trim().length < 3 || voidDocument.isPending}
              onClick={confirmVoid}
            >
              {voidDocument.isPending ? 'Descartando…' : 'Descartar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
