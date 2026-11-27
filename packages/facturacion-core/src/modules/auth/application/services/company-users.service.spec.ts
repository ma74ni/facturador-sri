import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CompanyUsersService } from './company-users.service';

const member = (overrides: Record<string, unknown> = {}) => ({
  id: 'u2',
  firstName: 'Lucía',
  lastName: 'Pérez',
  email: 'contadora@example.com',
  role: 'VIEWER',
  isActive: true,
  emailVerified: false,
  passwordResetExpiry: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  ...overrides,
});

function setup({
  existing = null as unknown,
  found = member() as unknown,
  otherAdmins = 1,
  lastSent = null as Date | null,
} = {}) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([member()]),
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn((args: { where: { id: string }; select: Record<string, unknown> }) => {
        if (args.select.lastPasswordResetSent) {
          return Promise.resolve({ lastPasswordResetSent: lastSent });
        }
        if (args.where.id === 'admin')
          return Promise.resolve({ firstName: 'Diego', lastName: 'P' });
        return Promise.resolve(found);
      }),
      // Como Prisma con `select`: solo devuelve los campos pedidos (nunca la contraseña).
      create: jest.fn((args: { data: Record<string, unknown>; select: Record<string, unknown> }) =>
        Promise.resolve(
          Object.fromEntries(
            Object.entries(member({ ...args.data, id: 'new' })).filter(
              ([key]) => key in args.select,
            ),
          ),
        ),
      ),
      update: jest.fn((args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({ ...(found as object), ...args.data }),
      ),
      // Primero las invitaciones pendientes (al invitar) o los otros administradores.
      count: jest.fn().mockResolvedValue(otherAdmins),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ businessName: 'LATTIA', tradeName: null }),
    },
  };
  // El servicio usa el mismo cliente dentro de la transacción.
  Object.assign(prisma, { $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)) });
  const email = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
  const planUsage = { assertCanAddUser: jest.fn().mockResolvedValue(undefined) };
  const service = new CompanyUsersService(prisma as never, email as never, planUsage as never);
  return { service, prisma, email, planUsage };
}

const invite = (role = 'VIEWER') => ({
  firstName: 'Lucía',
  lastName: 'Pérez',
  email: 'contadora@example.com',
  role: role as 'VIEWER',
});

describe('usuarios de la empresa', () => {
  it('invita con un enlace para crear la contraseña; el contador no cuenta para el plan', async () => {
    const { service, prisma, email, planUsage } = setup();

    const result = await service.invite(invite('VIEWER'), 'c1', 'admin');

    expect(planUsage.assertCanAddUser).not.toHaveBeenCalled();
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'contadora@example.com',
      role: 'VIEWER',
      companyId: 'c1',
      emailVerified: false,
    });
    // Se guarda el hash del enlace, nunca el enlace.
    expect(data.passwordResetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    const link = email.sendEmail.mock.calls[0][0].context.inviteLink as string;
    expect(link).toMatch(/\/reset-password\?token=[0-9a-f]{64}&invitacion=1$/);
    expect(link).not.toContain(data.passwordResetTokenHash);
    expect(email.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'contadora@example.com',
      template: 'user-invitation',
      context: { companyName: 'LATTIA', roleName: 'Contador', inviterName: 'Diego P' },
    });
    expect(result).toMatchObject({ invitationPending: true, emailSent: true });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordResetExpiry');
  });

  it('un administrador o usuario sí cuenta para el plan', async () => {
    const { service, planUsage } = setup();
    await service.invite(invite('ADMIN'), 'c1', 'admin');
    expect(planUsage.assertCanAddUser).toHaveBeenCalledWith('c1');
  });

  it('un correo que ya tiene cuenta no se invita, sin decir de qué empresa es', async () => {
    await expect(
      setup({ existing: { companyId: 'c1' } }).service.invite(invite(), 'c1', 'admin'),
    ).rejects.toThrow('ya tiene acceso a tu empresa');
    await expect(
      setup({ existing: { companyId: 'c9' } }).service.invite(invite(), 'c1', 'admin'),
    ).rejects.toThrow(
      new ConflictException('Ese correo ya tiene una cuenta en el sistema: usa otro'),
    );
  });

  it('solo administra usuarios de su empresa', async () => {
    const { service, prisma } = setup({ found: null });
    await expect(service.update('u2', { role: 'USER' }, 'c1', 'admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'u2', companyId: 'c1' });
  });

  it('pasar un contador a usuario cuenta para el plan; desactivar cierra sus sesiones', async () => {
    const promote = setup();
    await promote.service.update('u2', { role: 'USER' }, 'c1', 'admin');
    expect(promote.planUsage.assertCanAddUser).toHaveBeenCalledWith('c1');

    const off = setup({ found: member({ role: 'USER' }) });
    await off.service.update('u2', { isActive: false }, 'c1', 'admin');
    expect(off.planUsage.assertCanAddUser).not.toHaveBeenCalled();
    expect(off.prisma.user.update.mock.calls[0][0].data).toMatchObject({
      isActive: false,
      refreshTokens: { updateMany: { where: { revokedAt: null } } },
    });
  });

  it('no deja cambiarse a sí mismo ni quedar sin administrador', async () => {
    await expect(
      setup({ found: member({ id: 'admin', role: 'ADMIN' }) }).service.update(
        'admin',
        { role: 'USER' },
        'c1',
        'admin',
      ),
    ).rejects.toThrow('No puedes cambiar tu propio rol');
    await expect(
      setup({ found: member({ role: 'ADMIN' }), otherAdmins: 0 }).service.update(
        'u2',
        { isActive: false },
        'c1',
        'admin',
      ),
    ).rejects.toThrow('al menos un administrador');
  });

  it('reenvía la invitación solo si falta la contraseña, y no dos veces seguidas', async () => {
    await expect(
      setup({ found: member({ emailVerified: true }) }).service.resendInvitation(
        'u2',
        'c1',
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup({ lastSent: new Date() }).service.resendInvitation('u2', 'c1', 'admin'),
    ).rejects.toThrow('Espera un minuto');

    const ok = setup({ lastSent: new Date(Date.now() - 120_000) });
    await ok.service.resendInvitation('u2', 'c1', 'admin');
    expect(ok.email.sendEmail).toHaveBeenCalled();
    expect(ok.prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'u2' });
  });

  it('no deja acumular invitaciones sin aceptar (frena el envío de correos)', async () => {
    const { service, prisma } = setup();
    prisma.user.count.mockResolvedValueOnce(10);
    await expect(service.invite(invite(), 'c1', 'admin')).rejects.toThrow(
      'invitaciones sin aceptar',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.count.mock.calls[0][0].where).toEqual({
      companyId: 'c1',
      isActive: true,
      emailVerified: false,
    });
  });
});
