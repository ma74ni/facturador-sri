'use client';

import { Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@facturador-sri/ui';
import { useAuth } from '@/lib/context/auth-context';
import { usePermissions } from '@/lib/hooks/use-company-users';

/** Aviso para el contador: ve y descarga todo, pero no cambia nada. */
export function ReadOnlyBanner() {
  const { company } = useAuth();
  const { isAccountant } = usePermissions();
  if (!isAccountant) return null;
  return (
    <Alert variant="info" className="mb-4">
      <Eye />
      <AlertDescription>
        Estás en {company?.tradeName || company?.businessName || 'la empresa'} como contador: puedes
        ver y descargar todo, sin cambiar nada.
      </AlertDescription>
    </Alert>
  );
}
