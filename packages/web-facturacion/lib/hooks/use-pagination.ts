import { useEffect, useState } from 'react';

/**
 * Paginación en el cliente sobre una lista ya cargada (y ya filtrada).
 *
 * - `resetKey`: cuando cambia (ej. el texto de búsqueda o un filtro), vuelve a
 *   la página 1 — si no, podrías quedar en la página 4 de un resultado que
 *   ahora tiene 1 sola página.
 * - Si la lista se achica (ej. se borró el último ítem de la última página),
 *   la página se ajusta sola a la última existente.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    pageItems,
    page: currentPage,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    // Rango 1-based de lo que se está mostrando, para "Mostrando 11–20 de 45"
    from: totalItems === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, totalItems),
  };
}
