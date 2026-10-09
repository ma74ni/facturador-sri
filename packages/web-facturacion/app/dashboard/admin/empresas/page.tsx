'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CompanyStatusBadge, ReadinessPills } from '@/components/admin/company-status';
import { useAdminCompanies, useProductModules } from '@/lib/hooks/use-platform-admin';
import { CompanyListFilter } from '@/lib/api/platform-admin';

/** Módulos habilitados de una empresa, por nombre. */
function ModuleBadges({ keys, names }: { keys: string[]; names: Record<string, string> }) {
  if (keys.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {keys.map((key) => (
        <span key={key} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
          {names[key] ?? key}
        </span>
      ))}
    </div>
  );
}

const FILTERS: Array<{ value: CompanyListFilter | 'ALL'; label: string }> = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas (pruebas)' },
  { value: 'PRODUCTION', label: 'En producción' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'ALL', label: 'Todas' },
];

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-EC');

export default function AdminEmpresasPage() {
  const [filter, setFilter] = useState<CompanyListFilter | 'ALL'>('PENDING');
  const { data: companies = [], isLoading } = useAdminCompanies(filter === 'ALL' ? undefined : filter);
  const { data: modules = [] } = useProductModules();
  const moduleNames = Object.fromEntries(modules.map((module) => [module.key, module.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay empresas en esta categoría.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <div className="space-y-3 md:hidden">
            {companies.map((company) => (
              <Link key={company.id} href={`/dashboard/admin/empresas/${company.id}`} className="block">
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{company.businessName}</p>
                        <p className="text-xs text-muted-foreground">RUC {company.ruc}</p>
                        <ModuleBadges keys={company.enabledModules} names={moduleNames} />
                      </div>
                      <CompanyStatusBadge status={company.status} environment={company.environment} />
                    </div>
                    <ReadinessPills readiness={company.readiness} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Requisitos para producción</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/dashboard/admin/empresas/${company.id}`} className="block">
                        <p className="font-medium">{company.businessName}</p>
                        <p className="text-xs text-muted-foreground">
                          RUC {company.ruc} · {company.email}
                        </p>
                        <ModuleBadges keys={company.enabledModules} names={moduleNames} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CompanyStatusBadge status={company.status} environment={company.environment} />
                    </TableCell>
                    <TableCell>
                      <ReadinessPills readiness={company.readiness} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(company.createdAt)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/admin/empresas/${company.id}`} aria-label="Ver detalle">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
