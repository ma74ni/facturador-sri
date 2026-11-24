'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/auth-context';
import { COMPRAS_MODULE, hasModule } from '@/lib/product-modules';

const TABS = [
  { name: 'Compras', href: '/dashboard/compras', exact: true },
  { name: 'Proveedores', href: '/dashboard/compras/proveedores', exact: false },
  { name: 'Cuentas de gasto', href: '/dashboard/compras/cuentas', exact: false },
];

/**
 * Pestañas de Compras. Defensa en profundidad además del RequireModuleGuard del backend: si la
 * company del tenant no tiene "compras" habilitado, no se puede navegar acá
 * aunque se conozca la URL directamente.
 */
export default function ComprasLayout({ children }: { children: React.ReactNode }) {
  const { company, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !hasModule(company?.enabledModules, COMPRAS_MODULE)) {
      router.push('/dashboard');
    }
  }, [isLoading, company, router]);

  if (isLoading || !hasModule(company?.enabledModules, COMPRAS_MODULE)) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <nav
        aria-label="Secciones de Compras"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-outline-variant"
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || (!tab.exact && pathname.startsWith(`${tab.href}/`));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-label-lg transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface',
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
