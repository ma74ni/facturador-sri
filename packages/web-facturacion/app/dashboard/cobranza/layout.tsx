'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { COBRANZA_MODULE, hasModule } from '@/lib/product-modules';

/**
 * Defensa en profundidad además del RequireModuleGuard del backend: si la
 * company del tenant no tiene "cobranza" habilitado, no se puede navegar acá
 * aunque se conozca la URL directamente.
 */
export default function CobranzaLayout({ children }: { children: React.ReactNode }) {
  const { company, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hasModule(company?.enabledModules, COBRANZA_MODULE)) {
      router.push('/dashboard');
    }
  }, [isLoading, company, router]);

  if (isLoading || !hasModule(company?.enabledModules, COBRANZA_MODULE)) {
    return null;
  }

  return <>{children}</>;
}
