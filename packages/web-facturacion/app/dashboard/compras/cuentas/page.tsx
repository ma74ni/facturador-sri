'use client';

import { useMemo, useState } from 'react';
import { ClipboardPaste, Edit, Loader2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  FilterBar,
  IconButton,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseAccountDialog } from '@/components/purchases/expense-account-dialog';
import { ImportAccountsDialog } from '@/components/purchases/import-accounts-dialog';
import { ExpenseAccount, ExpenseAccountInput } from '@/lib/api/expense-accounts';
import {
  useCreateExpenseAccount,
  useDeleteExpenseAccount,
  useExpenseAccounts,
  useImportExpenseAccounts,
  useUpdateExpenseAccount,
} from '@/lib/hooks/use-expense-accounts';
import { usePagination } from '@/lib/hooks/use-pagination';

/** Busca en código y nombre, sin distinguir mayúsculas. */
function matches(account: ExpenseAccount, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [account.code ?? '', account.name].some((value) => value.toLowerCase().includes(term));
}

/** Catálogo de cuentas de gasto de la empresa (módulo Compras). */
export default function CuentasDeGastoPage() {
  const [showInactive, setShowInactive] = useState(false);
  const { data: accounts = [], isLoading } = useExpenseAccounts(true);
  const create = useCreateExpenseAccount();
  const update = useUpdateExpenseAccount();
  const remove = useDeleteExpenseAccount();
  const importList = useImportExpenseAccounts();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseAccount | null>(null);
  const [toDelete, setToDelete] = useState<ExpenseAccount | null>(null);

  const activeCount = accounts.filter((account) => account.isActive).length;
  const inactiveCount = accounts.length - activeCount;
  const filtered = useMemo(
    () =>
      accounts.filter((account) => (showInactive || account.isActive) && matches(account, search)),
    [accounts, search, showInactive],
  );
  const pagination = usePagination(filtered, 15, `${search}|${showInactive}`);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (account: ExpenseAccount) => {
    setEditing(account);
    setDialogOpen(true);
  };
  const save = (data: ExpenseAccountInput) =>
    editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data);
  const toggleActive = (account: ExpenseAccount) =>
    update.mutate({ id: account.id, data: { isActive: !account.isActive } });

  const actions = (account: ExpenseAccount) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton label="Editar cuenta" onClick={() => openEdit(account)}>
        <Edit />
      </IconButton>
      <IconButton
        label={account.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
        onClick={() => toggleActive(account)}
      >
        {account.isActive ? <PowerOff /> : <Power />}
      </IconButton>
      <IconButton label="Eliminar cuenta" tone="destructive" onClick={() => setToDelete(account)}>
        <Trash2 />
      </IconButton>
    </div>
  );

  const empty = accounts.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Cuentas de gasto</h1>
          <p className="text-body-md text-on-surface-variant">
            A qué cuenta del contador va cada compra
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outlined" onClick={() => setImportOpen(true)}>
            <ClipboardPaste />
            Pegar lista del contador
          </Button>
          <Button onClick={openCreate}>
            <Plus />
            Nueva cuenta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo ({activeCount})</CardTitle>
          <CardDescription>
            Las inactivas ya no se ofrecen al registrar compras, pero las compras que las usan las
            conservan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!empty && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Buscar por código o nombre…"
                />
              </div>
              {inactiveCount > 0 && (
                <label className="flex items-center gap-2 text-body-md text-on-surface">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  Mostrar inactivas ({inactiveCount})
                </label>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-title-md text-on-surface">
                {empty ? 'Carga las cuentas de tu contador' : 'Sin resultados'}
              </p>
              <p className="mb-4 max-w-md text-body-md text-on-surface-variant">
                {empty
                  ? 'Pide a tu contador su lista de cuentas de gasto y pégala de una vez, o créalas una por una.'
                  : 'Ninguna cuenta coincide con la búsqueda.'}
              </p>
              {empty ? (
                <Button onClick={() => setImportOpen(true)}>
                  <ClipboardPaste />
                  Pegar lista del contador
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => setSearch('')}>
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-body-sm">
                        {account.code ?? <span className="text-on-surface-variant">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span
                          className={
                            account.isActive ? 'text-on-surface' : 'text-on-surface-variant'
                          }
                        >
                          {account.name}
                        </span>
                        {!account.isActive && (
                          <Badge variant="secondary" className="ml-2">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{actions(account)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination {...pagination} onPageChange={pagination.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <ExpenseAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSubmit={save}
        saving={create.isPending || update.isPending}
      />

      <ImportAccountsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(text) => importList.mutateAsync(text)}
        importing={importList.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.name}</strong>. Si solo ya no la usas, puedes
              desactivarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-on-error"
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
