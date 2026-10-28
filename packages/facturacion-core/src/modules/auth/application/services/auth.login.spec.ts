import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const PASSWORD = 'clave-correcta';

async function setup(overrides: { isActive: boolean }) {
  const user = {
    id: 'user-1',
    email: 'ana@example.com',
    password: await bcrypt.hash(PASSWORD, 4),
    firstName: 'Ana',
    lastName: 'López',
    ...overrides,
  };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const jwtService = { sign: jest.fn().mockReturnValue('token-firmado') };
  const service = new AuthService(prisma as any, jwtService as any, {} as any);
  return { service, jwtService };
}

describe('AuthService · login', () => {
  it('entrega un token a un usuario activo con la contraseña correcta', async () => {
    const { service } = await setup({ isActive: true });

    const result = await service.login({ email: 'ana@example.com', password: PASSWORD });

    expect(result.access_token).toBe('token-firmado');
  });

  it('no deja entrar a un usuario desactivado y le dice por qué', async () => {
    const { service, jwtService } = await setup({ isActive: false });

    await expect(service.login({ email: 'ana@example.com', password: PASSWORD })).rejects.toThrow(
      new UnauthorizedException(
        'Tu usuario está desactivado. Contacta al administrador de tu empresa.',
      ),
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('a un usuario desactivado con contraseña incorrecta le responde como a cualquiera', async () => {
    const { service } = await setup({ isActive: false });

    await expect(service.login({ email: 'ana@example.com', password: 'otra' })).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });
});
