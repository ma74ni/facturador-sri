'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/filter-bar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, UploadCloud } from 'lucide-react';
import { useCustomers } from '@/lib/hooks/use-customers';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';

export default function CobranzaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: customers = [], isLoading } = useCustomers();

  const filtered = customers.filter((customer) => {
    const name = customer.businessName || `${customer.firstName} ${customer.lastName}`;
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.identification.includes(searchTerm)
    );
  });

  const pagination = usePagination(filtered, 10, searchTerm);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cobranza</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Estado de cuenta por cliente: facturas emitidas, pagos recibidos y saldo pendiente
          </p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashboard/cobranza/importar">
            <UploadCloud className="mr-2 h-4 w-4" />
            Importar histórico
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar cliente</CardTitle>
          <CardDescription>Elegí un cliente para ver su estado de cuenta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por nombre o RUC/CI..."
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No se encontraron clientes</p>
          ) : (
            <>
              {/* Vista mobile: toda la card es el link al estado de cuenta */}
              <div className="md:hidden space-y-2">
                {pagination.pageItems.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/dashboard/cobranza/${customer.id}`}
                    className="flex items-center justify-between gap-2 border rounded-lg p-4 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm break-words">
                        {customer.businessName || `${customer.firstName} ${customer.lastName}`}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{customer.identification}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.businessName || `${customer.firstName} ${customer.lastName}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {customer.identification}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/cobranza/${customer.id}`}>
                              Ver estado de cuenta
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
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
    </div>
  );
}
