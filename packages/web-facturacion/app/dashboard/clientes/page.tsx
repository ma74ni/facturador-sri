'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Edit, Trash2, Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { Customer, CreateCustomerDto } from '@/lib/api/customers';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '@/lib/hooks/use-customers';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { NativeSelect } from '@/components/ui/native-select';

type CustomerSort = 'recent' | 'name';

const ID_TYPE_LABEL: Record<string, string> = {
  CEDULA: 'Cédula',
  RUC: 'RUC',
  PASAPORTE: 'Pasaporte',
  CONSUMIDOR_FINAL: 'Consumidor final',
};

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [idTypeFilter, setIdTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<CustomerSort>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // React Query hooks
  const { data: customers = [], isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const handleCreate = () => {
    setSelectedCustomer(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const handleSave = async (data: CreateCustomerDto) => {
    try {
      if (selectedCustomer) {
        await updateCustomer.mutateAsync({ id: selectedCustomer.id, data });
      } else {
        await createCustomer.mutateAsync(data);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled by mutation hooks
      throw error;
    }
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomer.mutateAsync(customerToDelete.id);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error) {
      // Error handled by mutation hook
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  const getNombre = (customer: Customer) =>
    customer.businessName || `${customer.firstName} ${customer.lastName}`;

  // Solo los tipos que efectivamente tiene algún cliente
  const idTypeOptions = Array.from(new Set(customers.map((c) => c.identificationType))).sort();

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      getNombre(customer).toLowerCase().includes(searchLower) ||
      customer.identification.includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower);
    const matchesType = idTypeFilter === 'all' || customer.identificationType === idTypeFilter;
    return matchesSearch && matchesType;
  }).sort((a, b) =>
    sortBy === 'name'
      ? getNombre(a).localeCompare(getNombre(b), 'es')
      : b.createdAt.localeCompare(a.createdAt)
  );

  const clearFilters = () => {
    setSearchTerm('');
    setIdTypeFilter('all');
  };

  const pagination = usePagination(filteredCustomers, 10, `${searchTerm}|${idTypeFilter}|${sortBy}`);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona tu base de clientes
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Clientes Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Clientes (
            {filteredCustomers.length === customers.length
              ? customers.length
              : `${filteredCustomers.length} de ${customers.length}`}
            )
          </CardTitle>
          <CardDescription>
            Todos los clientes registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customers.length > 0 && (
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por nombre, RUC/CI o email..."
              activeCount={idTypeFilter !== 'all' ? 1 : 0}
              onClear={clearFilters}
            >
              <FilterField label="Tipo de identificación">
                <NativeSelect value={idTypeFilter} onChange={(e) => setIdTypeFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  {idTypeOptions.map((type) => (
                    <option key={type} value={type}>{ID_TYPE_LABEL[type] ?? type}</option>
                  ))}
                </NativeSelect>
              </FilterField>
              <FilterField label="Ordenar por">
                <NativeSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as CustomerSort)}>
                  <option value="recent">Más recientes</option>
                  <option value="name">Nombre (A–Z)</option>
                </NativeSelect>
              </FilterField>
            </FilterBar>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-100 p-6 mb-4">
                <Plus className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {customers.length === 0
                  ? 'No hay clientes registrados'
                  : 'No se encontraron resultados'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {customers.length === 0
                  ? 'Comienza agregando tu primer cliente para poder emitir facturas electrónicas.'
                  : 'Ningún cliente coincide con la búsqueda o los filtros'}
              </p>
              {customers.length === 0 ? (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primer Cliente
                </Button>
              ) : (
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Vista mobile: una card por cliente */}
              <div className="md:hidden space-y-3">
                {pagination.pageItems.map((customer) => (
                  <div key={customer.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={customer.identificationType === 'RUC' ? 'default' : 'secondary'} className="text-xs">
                            {customer.identificationType}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            {customer.identification}
                          </span>
                        </div>
                        <p className="font-medium text-sm break-words">
                          {customer.businessName || `${customer.firstName} ${customer.lastName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          className="h-9 w-9 p-0"
                          aria-label="Editar cliente"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(customer)}
                          className="h-9 w-9 p-0"
                          aria-label="Eliminar cliente"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {(customer.email || customer.phone || customer.address) && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {customer.email && (
                          <div className="flex items-center gap-1 min-w-0">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="hidden lg:table-cell">Dirección</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={customer.identificationType === 'RUC' ? 'default' : 'secondary'} className="text-xs">
                                {customer.identificationType}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                {customer.identification}
                              </span>
                            </div>
                            <span className="font-medium text-sm">
                              {customer.businessName || `${customer.firstName} ${customer.lastName}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Mail className="mr-1 h-3 w-3" />
                                <span className="truncate max-w-[200px]">{customer.email}</span>
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Phone className="mr-1 h-3 w-3" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {customer.address && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="mr-1 h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-xs">{customer.address}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                              className="h-9 w-9 p-0"
                              aria-label="Editar cliente"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(customer)}
                              className="h-9 w-9 p-0"
                              aria-label="Eliminar cliente"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
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

      {/* Stats */}
      {customers.length > 0 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
              <p className="text-xs text-muted-foreground">
                clientes registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Empresas (RUC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter(c => c.identificationType === 'RUC').length}
              </div>
              <p className="text-xs text-muted-foreground">
                clientes corporativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Personas (CI)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.filter(c => c.identificationType === 'CEDULA').length}
              </div>
              <p className="text-xs text-muted-foreground">
                clientes individuales
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Customer Dialog */}
      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        customer={selectedCustomer}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el cliente{' '}
              <strong>
                {customerToDelete?.businessName ||
                  `${customerToDelete?.firstName} ${customerToDelete?.lastName}`}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
