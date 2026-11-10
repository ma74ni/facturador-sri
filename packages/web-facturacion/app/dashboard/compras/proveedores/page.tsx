'use client';

import { useMemo, useState } from 'react';
import { Edit, Loader2, Mail, Phone, Plus, Trash2 } from 'lucide-react';
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
import { SupplierDialog } from '@/components/suppliers/supplier-dialog';
import {
  Supplier,
  SUPPLIER_ID_TYPE,
  SUPPLIER_ID_TYPE_LABELS,
  SupplierInput,
} from '@/lib/api/suppliers';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/lib/hooks/use-suppliers';
import { usePagination } from '@/lib/hooks/use-pagination';

/** Busca en razón social, nombre comercial e identificación, sin distinguir mayúsculas. */
function matches(supplier: Supplier, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [supplier.businessName, supplier.tradeName ?? '', supplier.identification].some((value) =>
    value.toLowerCase().includes(term),
  );
}

/** Tipo de identificación y marcas del proveedor (sin RUC, negocio popular). */
function SupplierBadges({ supplier }: { supplier: Supplier }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge
        variant={supplier.identificationType === SUPPLIER_ID_TYPE.RUC ? 'default' : 'secondary'}
      >
        {SUPPLIER_ID_TYPE_LABELS[supplier.identificationType] ?? supplier.identificationType}
      </Badge>
      {supplier.identificationType !== SUPPLIER_ID_TYPE.RUC && (
        <Badge variant="warning">Sin RUC</Badge>
      )}
      {supplier.isPopularBusiness && <Badge variant="info">Negocio popular</Badge>}
    </span>
  );
}

function Contact({ supplier }: { supplier: Supplier }) {
  if (!supplier.email && !supplier.phone) {
    return <span className="text-on-surface-variant">—</span>;
  }
  return (
    <span className="space-y-0.5 text-body-sm text-on-surface-variant">
      {supplier.email && (
        <span className="flex min-w-0 items-center gap-1">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{supplier.email}</span>
        </span>
      )}
      {supplier.phone && (
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3 shrink-0" />
          {supplier.phone}
        </span>
      )}
    </span>
  );
}

/** Proveedores de la empresa (módulo Compras): mismo patrón que Clientes. */
export default function ProveedoresPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const remove = useDeleteSupplier();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  const filtered = useMemo(() => suppliers.filter((s) => matches(s, search)), [suppliers, search]);
  const pagination = usePagination(filtered, 10, search);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setDialogOpen(true);
  };
  const save = (data: SupplierInput) =>
    editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data);

  const actions = (supplier: Supplier) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton label="Editar proveedor" onClick={() => openEdit(supplier)}>
        <Edit />
      </IconButton>
      <IconButton
        label="Eliminar proveedor"
        tone="destructive"
        onClick={() => setToDelete(supplier)}
      >
        <Trash2 />
      </IconButton>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Proveedores</h1>
          <p className="text-body-md text-on-surface-variant">A quién le compras</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de proveedores ({suppliers.length})</CardTitle>
          <CardDescription>Los que se usan en tus compras y liquidaciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suppliers.length > 0 && (
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Buscar por nombre o RUC/CI…"
            />
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-title-md text-on-surface">
                {suppliers.length === 0 ? 'Registra tu primer proveedor' : 'Sin resultados'}
              </p>
              <p className="mb-4 max-w-sm text-body-md text-on-surface-variant">
                {suppliers.length === 0
                  ? 'Los proveedores son a quienes les compras: los vas a elegir al registrar cada compra.'
                  : 'Ningún proveedor coincide con la búsqueda.'}
              </p>
              {suppliers.length === 0 ? (
                <Button onClick={openCreate}>
                  <Plus />
                  Nuevo proveedor
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => setSearch('')}>
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {pagination.pageItems.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="space-y-2 rounded-lg border border-outline-variant p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <SupplierBadges supplier={supplier} />
                        <p className="break-words text-title-sm text-on-surface">
                          {supplier.businessName}
                        </p>
                        <p className="font-mono text-body-sm text-on-surface-variant">
                          {supplier.identification}
                        </p>
                      </div>
                      {actions(supplier)}
                    </div>
                    <Contact supplier={supplier} />
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="whitespace-normal">
                          <p className="text-title-sm text-on-surface">{supplier.businessName}</p>
                          {supplier.tradeName && (
                            <p className="text-body-sm text-on-surface-variant">
                              {supplier.tradeName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <SupplierBadges supplier={supplier} />
                            <p className="font-mono text-body-sm">{supplier.identification}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Contact supplier={supplier} />
                        </TableCell>
                        <TableCell>{actions(supplier)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination {...pagination} onPageChange={pagination.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
        onSubmit={save}
        saving={create.isPending || update.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.businessName}</strong>. Esta acción no se puede
              deshacer.
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
