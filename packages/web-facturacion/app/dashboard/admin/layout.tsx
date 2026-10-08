'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';

const TABS = [
  { name: 'Empresas', href: '/dashboard/admin/empresas' },
  { name: 'Administradores', href: '/dashboard/admin/administradores' },
];

/**
 * Panel de administración de la plataforma. La API ya exige el permiso
 * (PlatformAdminGuard); aquí solo se evita mostrar la sección a quien no lo tiene.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user?.isPlatformAdmin) {
      router.push('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user?.isPlatformAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Administración</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Aprueba empresas y pásalas al ambiente de producción del SRI
        </p>
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
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
