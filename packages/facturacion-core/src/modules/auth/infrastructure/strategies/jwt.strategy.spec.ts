import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const findUnique = jest.fn();
  const strategy = new JwtStrategy(
    { get: () => 'secreto-de-prueba' } as unknown as ConfigService,
    { user: { findUnique } } as unknown as PrismaService,
  );

  beforeEach(() => findUnique.mockReset());

  it('deja en la petición el usuario con su empresa actual', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@empresa.ec',
      companyId: 'c1',
      isActive: true,
      passwordChangedAt: null,
    });

    await expect(strategy.validate({ sub: 'u1', iat: 1_700_000_000 })).resolves.toEqual({
      userId: 'u1',
      email: 'ana@empresa.ec',
      companyId: 'c1',
    });
  });

  it('rechaza el token de un usuario que ya no existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'borrado' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token emitido antes del último cambio de contraseña', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@empresa.ec',
      companyId: 'c1',
      isActive: true,
      passwordChangedAt: new Date('2026-10-01T12:00:00Z'),
    });
    const issuedBefore = Math.floor(new Date('2026-10-01T11:00:00Z').getTime() / 1000);

    await expect(strategy.validate({ sub: 'u1', iat: issuedBefore })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza el token de un usuario desactivado aunque la sesión siga abierta', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@empresa.ec',
      companyId: 'c1',
      isActive: false,
      passwordChangedAt: null,
    });

    await expect(strategy.validate({ sub: 'u1', iat: 1_700_000_000 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
