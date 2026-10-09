import { PlatformAdminsService } from './platform-admins.service';
import { PlatformAuditService } from './platform-audit.service';

describe('PlatformAdminsService', () => {
  function setup(target: Record<string, unknown> | null) {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ id: 'u-2', email: 'nuevo@siete8.com' }) },
      platformAuditLog: { create: jest.fn() },
    };
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) =>
          where.id === 'admin-1' ? { id: 'admin-1', email: 'admin@siete8.com' } : target,
        ),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlatformAdminsService(prisma as never, new PlatformAuditService(prisma as never));
    return { service, tx };
  }

  it('da el permiso a un usuario verificado y lo audita', async () => {
    const { service, tx } = setup({ id: 'u-2', isPlatformAdmin: false, emailVerified: true, isActive: true });
    await service.grant('admin-1', 'nuevo@siete8.com');
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-2' }, data: { isPlatformAdmin: true } }));
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'PLATFORM_ADMIN_GRANTED', targetUserId: 'u-2' }) }),
    );
  });

  it('no da el permiso a un usuario sin verificar', async () => {
    const { service, tx } = setup({ id: 'u-2', isPlatformAdmin: false, emailVerified: false, isActive: true });
    await expect(service.grant('admin-1', 'nuevo@siete8.com')).rejects.toThrow('email verificado');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('nadie se quita su propio permiso', async () => {
    const { service, tx } = setup(null);
    await expect(service.revoke('admin-1', 'admin-1')).rejects.toThrow('No puedes quitarte tu propio permiso');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('quita el permiso a otro administrador', async () => {
    const { service, tx } = setup({ id: 'u-2', email: 'otro@siete8.com', isPlatformAdmin: true });
    await service.revoke('admin-1', 'u-2');
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u-2' }, data: { isPlatformAdmin: false } });
  });
});
