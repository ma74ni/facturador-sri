'use client';

import { useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/context/auth-context';
import { PlatformAdmin } from '@/lib/api/platform-admin';
import {
  useGrantPlatformAdmin,
  usePlatformAdmins,
  useRevokePlatformAdmin,
} from '@/lib/hooks/use-platform-admin';

export default function AdminAdministradoresPage() {
  const { user } = useAuth();
  const { data: admins = [], isLoading } = usePlatformAdmins();
  const grant = useGrantPlatformAdmin();
  const revoke = useRevokePlatformAdmin();
  const [email, setEmail] = useState('');
  const [toRevoke, setToRevoke] = useState<PlatformAdmin | null>(null);

  const handleGrant = (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    grant.mutate(value, { onSuccess: () => setEmail('') });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Administradores de la plataforma</CardTitle>
          <CardDescription>Pueden aprobar empresas y pasarlas a producción.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {admin.firstName} {admin.lastName}
                      {admin.id === user?.id ? <span className="text-muted-foreground"> (tú)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {admin.email} · {admin.company.businessName}
                    </p>
                  </div>
                  {admin.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Quitar permiso a ${admin.email}`}
                      onClick={() => setToRevoke(admin)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar administrador</CardTitle>
          <CardDescription>
            La persona debe tener una cuenta en el facturador con el correo verificado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGrant} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="admin-email">Correo</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="persona@siete8.com"
              />
            </div>
            <Button type="submit" disabled={!email.trim() || grant.isPending}>
              <UserPlus className="mr-2 h-4 w-4" />
              {grant.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={!!toRevoke} onOpenChange={(open) => !open && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar permiso de administrador</AlertDialogTitle>
            <AlertDialogDescription>
              {toRevoke?.email} dejará de ver el panel de administración. Su cuenta de empresa no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (toRevoke) revoke.mutate(toRevoke.id, { onSuccess: () => setToRevoke(null) });
              }}
            >
              {revoke.isPending ? 'Quitando...' : 'Quitar permiso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
