'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';

/**
 * Defensa en profundidad además del RequireModuleGuard del backend: si la
 * company del tenant no tiene "cobranza" habilitado, no se puede navegar acá
 * aunque se conozca la URL directamente.
 */
export default function CobranzaLayout({ children }: { children: React.ReactNode }) {
  const { company, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !company?.enabledModules?.includes('cobranza')) {
      router.push('/dashboard');
    }
  }, [isLoading, company, router]);

  if (isLoading || !company?.enabledModules?.includes('cobranza')) {
    return null;
  }

  return <>{children}</>;
}
