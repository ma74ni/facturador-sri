'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Configuración de caché
            staleTime: 5 * 60 * 1000, // 5 minutos - Los datos se consideran "frescos" durante este tiempo
            gcTime: 10 * 60 * 1000, // 10 minutos - Tiempo que los datos se mantienen en caché sin usar
            retry: 1, // Reintentar 1 vez en caso de error
            refetchOnWindowFocus: false, // No refrescar automáticamente cuando la ventana gana foco
            refetchOnReconnect: true, // Refrescar cuando se recupera la conexión
          },
          mutations: {
            // Configuración para mutations (create, update, delete)
            retry: 0, // No reintentar mutations
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools solo en desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
