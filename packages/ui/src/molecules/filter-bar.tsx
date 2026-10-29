'use client';

import * as React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '../atoms/input';
import { Button } from '../atoms/button';
import { cn } from '../lib/cn';

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  // Cantidad de filtros activos (sin contar la búsqueda): se muestra en el
  // botón "Filtros" del celular y habilita "Limpiar filtros".
  activeCount?: number;
  onClear?: () => void;
  // Los filtros en sí (usar <FilterField> para cada uno)
  children?: React.ReactNode;
}

// Buscador + filtros. En celular los filtros quedan plegados detrás de un
// botón para no empujar la lista hacia abajo; desde md: van siempre en línea.
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  activeCount = 0,
  onClear,
  children,
}: FilterBarProps) {
  const [open, setOpen] = React.useState(false);
  const hasFilters = React.Children.count(children) > 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-on-surface-variant" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="outlined"
            className="md:hidden flex-shrink-0 h-10"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeCount > 0 && (
              <span className="ml-1 min-w-5 rounded-full bg-primary px-1.5 text-label-sm leading-5 text-on-primary">
                {activeCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {hasFilters && (
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end',
            !open && 'hidden md:flex',
          )}
        >
          {children}
          {activeCount > 0 && onClear && (
            <Button
              type="button"
              variant="text"
              onClick={onClear}
              className="h-10 sm:col-span-2 md:col-span-1"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Un filtro con su etiqueta arriba
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('space-y-1 md:w-44', className)}>
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
