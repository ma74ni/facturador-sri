import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const baseUser = {
  id: 'user-1',
  email: 'ana@example.com',
  password: 'hash-anterior',
  firstName: 'Ana',
  lastName: 'López',
  isActive: true,
  emailVerified: false,
  passwordResetTokenHash: null as string | null,
  passwordResetExpiry: null as Date | null,
  lastPasswordResetSent: null as Date | null,
};

function setup(user: typeof baseUser | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
  };
  const emailService = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
  const service = new AuthService(prisma as any, {} as any, emailService as any);
  return { service, prisma, emailService };
}

describe('AuthService · recuperación de contraseña', () => {
  describe('forgotPassword', () => {
    it('guarda solo el hash del token y envía el enlace con el token original', async () => {
      const { service, prisma, emailService } = setup({ ...baseUser });

      await service.forgotPassword({ email: 'ana@example.com' });

      const data = prisma.user.update.mock.calls[0][0].data;
      const { resetLink, expiryMinutes } = emailService.sendEmail.mock.calls[0][0].context;
      const token = new URL(resetLink).searchParams.get('token')!;

      expect(token).toHaveLength(64);
      expect(data.passwordResetTokenHash).toBe(sha256(token));
      expect(data.passwordResetTokenHash).not.toBe(token);
      expect(expiryMinutes).toBe(60);
      expect(data.passwordResetExpiry.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    });

    it('responde lo mismo si el email no existe, sin enviar nada', async () => {
      const existing = await setup({ ...baseUser }).service.forgotPassword({ email: 'ana@example.com' });
      const { service, prisma, emailService } = setup(null);

      const missing = await service.forgotPassword({ email: 'nadie@example.com' });

      expect(missing).toEqual(existing);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('no envía a usuarios desactivados', async () => {
      const { service, emailService } = setup({ ...baseUser, isActive: false });

      await service.forgotPassword({ email: 'ana@example.com' });

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('no reenvía si se pidió hace menos de un minuto', async () => {
      const { service, prisma, emailService } = setup({
        ...baseUser,
        lastPasswordResetSent: new Date(Date.now() - 20 * 1000),
      });

      await service.forgotPassword({ email: 'ana@example.com' });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const token = 'a'.repeat(64);

    it('cambia la contraseña, invalida el token y cierra sesiones anteriores', async () => {
      const { service, prisma } = setup({
        ...baseUser,
        passwordResetTokenHash: sha256(token),
        passwordResetExpiry: new Date(Date.now() + 10 * 60 * 1000),
      });

      await service.resetPassword({ token, password: 'nuevaClave123' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { passwordResetTokenHash: sha256(token) },
      });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(await bcrypt.compare('nuevaClave123', data.password)).toBe(true);
      expect(data.passwordResetTokenHash).toBeNull();
      expect(data.passwordResetExpiry).toBeNull();
      expect(data.passwordChangedAt).toBeInstanceOf(Date);
      expect(data.emailVerified).toBe(true);
    });

    it('rechaza un token desconocido o ya usado', async () => {
      const { service, prisma } = setup(null);

      await expect(service.resetPassword({ token, password: 'nuevaClave123' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza un token vencido', async () => {
      const { service, prisma } = setup({
        ...baseUser,
        passwordResetTokenHash: sha256(token),
        passwordResetExpiry: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword({ token, password: 'nuevaClave123' })).rejects.toThrow(
        'El enlace expiró',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
