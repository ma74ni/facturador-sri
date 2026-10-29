'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../atoms/button';
import { cn } from '../lib/cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Pie de paginación: "Mostrando X–Y de Z" + Anterior / N / M / Siguiente.
 * No se muestra si todo entra en una sola página.
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  from,
  to,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        'mt-4 flex flex-col items-center justify-between gap-3 border-t border-outline-variant pt-4 sm:flex-row',
        className,
      )}
    >
      <p className="text-body-md text-on-surface-variant">
        Mostrando {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outlined"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <span className="px-2 text-label-lg tabular-nums text-on-surface">
          {page} / {totalPages}
        </span>
        <Button
          variant="outlined"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
