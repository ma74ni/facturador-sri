'use client';

import { useState } from 'react';
import { Loader2, Mail, UserCheck, UserPlus, UserX } from 'lucide-react';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Menu,
  MenuContent,
  MenuIconTrigger,
  MenuItem,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AssignableRole,
  CompanyUser,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from '@/lib/api/company-users';
import { useAuth } from '@/lib/context/auth-context';
import {
  useCompanyUsers,
  useInviteUser,
  useResendInvitation,
  useUpdateCompanyUser,
} from '@/lib/hooks/use-company-users';
import { useMyPlanUsage } from '@/lib/hooks/use-plan';
import { cn } from '@/lib/utils';

const ROLES: AssignableRole[] = ['ADMIN', 'USER', 'VIEWER'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleBadge = (role: CompanyUser['role']) =>
  role === 'ADMIN' ? 'info' : role === 'VIEWER' ? 'success' : 'secondary';

const initials = (user: CompanyUser) =>
  `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

/**
 * Usuarios de la empresa: el administrador invita por correo con un rol, cambia roles y desactiva.
 * El contador (solo lectura) no cuenta para el plan.
 */
export function CompanyUsersCard() {
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useCompanyUsers();
  const { data: plan } = useMyPlanUsage();
  const invite = useInviteUser();
  const update = useUpdateCompanyUser();
  const resend = useResendInvitation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'VIEWER' as AssignableRole,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const startInvite = () => {
    setForm({ firstName: '', lastName: '', email: '', role: 'VIEWER' });
    setErrors({});
    setOpen(true);
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Falta el nombre';
    if (!form.lastName.trim()) next.lastName = 'Falta el apellido';
    if (!EMAIL.test(form.email.trim())) next.email = 'Escribe un correo válido';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await invite.mutateAsync({ ...form, email: form.email.trim() });
      setOpen(false);
    } catch {
      // El hook ya mostró el error.
    }
  };

  const usersLimit = plan?.users?.limit;
  const usersUsed = plan?.users?.used;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            {usersLimit != null && usersUsed != null
              ? `${usersUsed} de ${usersLimit} usuarios de tu plan · los contadores no cuentan`
              : 'Quiénes entran a tu empresa · los contadores no cuentan para tu plan'}
          </CardDescription>
        </div>
        <Button onClick={startInvite}>
          <UserPlus />
          Agregar usuario
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {users.map((user) => {
              const isMe = user.id === me?.id;
              return (
                <li
                  key={user.id}
                  className={cn('flex items-center gap-3 py-3', !user.isActive && 'opacity-60')}
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-label-lg text-on-surface-variant"
                  >
                    {initials(user)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-title-sm text-on-surface">
                      {user.firstName} {user.lastName}
                      {isMe && (
                        <span className="ml-1 text-body-sm text-on-surface-variant">(tú)</span>
                      )}
                    </p>
                    <p className="break-all text-body-sm text-on-surface-variant">
                      {user.email}
                      {!user.isActive ? (
                        ' · desactivado'
                      ) : user.invitationPending ? (
                        <span className="text-warning">
                          {user.invitationExpired
                            ? ' · la invitación venció: reenvíala'
                            : ' · invitación enviada, falta que cree su contraseña'}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Badge variant={roleBadge(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                  {isMe ? (
                    <span className="w-9" />
                  ) : (
                    <Menu>
                      <MenuIconTrigger label={`Acciones de ${user.firstName} ${user.lastName}`} />
                      <MenuContent>
                        {user.isActive &&
                          ROLES.filter((role) => role !== user.role).map((role) => (
                            <MenuItem
                              key={role}
                              onSelect={() => update.mutate({ id: user.id, data: { role } })}
                            >
                              <UserCheck />
                              Cambiar a {ROLE_LABELS[role]}
                            </MenuItem>
                          ))}
                        {user.isActive && user.invitationPending && (
                          <MenuItem onSelect={() => resend.mutate(user.id)}>
                            <Mail />
                            Reenviar invitación
                          </MenuItem>
                        )}
                        {user.isActive ? (
                          <MenuItem
                            tone="destructive"
                            onSelect={() =>
                              update.mutate({ id: user.id, data: { isActive: false } })
                            }
                          >
                            <UserX />
                            Desactivar
                          </MenuItem>
                        ) : (
                          <MenuItem
                            onSelect={() =>
                              update.mutate({ id: user.id, data: { isActive: true } })
                            }
                          >
                            <UserCheck />
                            Activar
                          </MenuItem>
                        )}
                      </MenuContent>
                    </Menu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Desactivar no borra a nadie: su historial queda, y no puede entrar.
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
            <DialogDescription>
              Le llega un correo para crear su contraseña; con eso queda verificado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Nombre *" htmlFor="invite-first" error={errors.firstName}>
                <Input
                  id="invite-first"
                  value={form.firstName}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </FormField>
              <FormField label="Apellido *" htmlFor="invite-last" error={errors.lastName}>
                <Input
                  id="invite-last"
                  value={form.lastName}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label="Correo *" htmlFor="invite-email" error={errors.email}>
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                maxLength={254}
                placeholder="correo@ejemplo.com"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-label-lg text-on-surface">Qué puede hacer</legend>
              {ROLES.map((role) => (
                <label
                  key={role}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                    form.role === role
                      ? 'border-primary bg-primary-container'
                      : 'border-outline-variant',
                  )}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={form.role === role}
                    onChange={() => setForm((f) => ({ ...f, role }))}
                  />
                  <span>
                    <span className="block text-title-sm text-on-surface">{ROLE_LABELS[role]}</span>
                    <span className="block text-body-sm text-on-surface-variant">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={invite.isPending}>
              {invite.isPending ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
