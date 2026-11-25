import { UnauthorizedException } from '@nestjs/common';

import { hashRefreshToken, REUSE_GRACE_MS, SessionService } from './session.service';

type Row = {
  id: string;
  userId: string;
  familyId: string;
  sessionStartedAt: Date;
  tokenHash: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  userAgent?: string | null;
  createdAt: Date;
};

/** Tabla refresh_tokens en memoria, con lo que usa SessionService. */
function setup(user = { id: 'u1', isActive: true, passwordChangedAt: null as Date | null }) {
  const rows: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: any) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'lt' in (value as any)) {
        return (row as any)[key] < (value as any).lt;
      }
      return (row as any)[key] === value;
    });
  const prisma = {
    user: { findUnique: jest.fn(async () => user) },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `rt${++seq}`,
          rotatedAt: null,
          revokedAt: null,
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        const row = rows.find((r) =>
          where.id ? r.id === where.id : r.tokenHash === where.tokenHash,
        );
        return row ? { ...row, ...(include ? { user } : {}) } : null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((row) => matches(row, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const jwtService = { sign: jest.fn(() => 'access-token') };
  const config = { get: jest.fn(() => undefined) };
  const service = new SessionService(prisma as any, jwtService as any, config as any);
  return { service, rows, jwtService, user };
}

const rejected = new UnauthorizedException('Sesión vencida');

describe('SessionService', () => {
  it('al iniciar guarda solo el hash del token y entrega un acceso corto', async () => {
    const { service, rows, jwtService } = setup();

    const session = await service.start('u1', 'Chrome');

    expect(session.refreshToken).toBeTruthy();
    expect(rows[0].tokenHash).toBe(hashRefreshToken(session.refreshToken!));
    expect(rows[0].tokenHash).not.toBe(session.refreshToken);
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'u1' }, { expiresIn: '1h' });
    expect(session.refreshExpiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
  });

  it('renovar cambia el token por uno nuevo de la misma sesión', async () => {
    const { service, rows } = setup();
    const first = await service.start('u1');

    const second = await service.refresh(first.refreshToken!);

    expect(second.refreshToken).toBeTruthy();
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(rows[0].rotatedAt).not.toBeNull();
    expect(rows[1].familyId).toBe(rows[0].familyId);
  });

  it('dos pestañas que renuevan a la vez no cierran la sesión', async () => {
    const { service } = setup();
    const first = await service.start('u1');
    await service.refresh(first.refreshToken!);

    const again = await service.refresh(first.refreshToken!);

    expect(again).toEqual({
      accessToken: 'access-token',
      refreshToken: null,
      refreshExpiresAt: null,
    });
  });

  it('un token ya cambiado que vuelve tarde revoca la sesión entera (robo)', async () => {
    const { service, rows } = setup();
    const first = await service.start('u1');
    const second = await service.refresh(first.refreshToken!);
    rows[0].rotatedAt = new Date(Date.now() - REUSE_GRACE_MS - 1000);

    await expect(service.refresh(first.refreshToken!)).rejects.toThrow(rejected);
    await expect(service.refresh(second.refreshToken!)).rejects.toThrow(rejected);
    expect(rows.every((row) => row.revokedAt)).toBe(true);
  });

  it('rechaza un token desconocido, vencido o de una sesión cerrada', async () => {
    const { service, rows } = setup();
    await expect(service.refresh(undefined)).rejects.toThrow(rejected);
    await expect(service.refresh('inventado')).rejects.toThrow(rejected);

    const expired = await service.start('u1');
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.refresh(expired.refreshToken!)).rejects.toThrow(rejected);

    const closed = await service.start('u1');
    await service.end(closed.refreshToken!);
    await expect(service.refresh(closed.refreshToken!)).rejects.toThrow(rejected);
  });

  it('un usuario desactivado o con contraseña cambiada ya no renueva', async () => {
    const inactive = setup({ id: 'u1', isActive: false, passwordChangedAt: null });
    const a = await inactive.service.start('u1');
    await expect(inactive.service.refresh(a.refreshToken!)).rejects.toThrow(rejected);

    const changed = setup({ id: 'u1', isActive: true, passwordChangedAt: null });
    const b = await changed.service.start('u1');
    changed.user.passwordChangedAt = new Date(Date.now() + 1000);
    await expect(changed.service.refresh(b.refreshToken!)).rejects.toThrow(rejected);
    expect(changed.rows[0].revokedAt).not.toBeNull();
  });

  it('un cambio de contraseña que entra durante la renovación no deja vivo el token nuevo', async () => {
    const { service, rows, user } = setup();
    const first = await service.start('u1');
    // Empieza la renovación con la contraseña vieja; el cambio entra justo antes de entregar.
    const prismaUser = (service as any).prisma.user.findUnique as jest.Mock;
    prismaUser.mockImplementationOnce(async () => ({
      ...user,
      passwordChangedAt: new Date(Date.now() + 1000),
    }));

    await expect(service.refresh(first.refreshToken!)).rejects.toThrow(rejected);
    expect(rows.every((row) => row.revokedAt)).toBe(true);
  });

  it('la sesión recuerda cuándo empezó aunque el token cambie', async () => {
    const { service, rows } = setup();
    const first = await service.start('u1');
    await service.refresh(first.refreshToken!);

    expect(rows[1].sessionStartedAt).toEqual(rows[0].sessionStartedAt);
  });
});
