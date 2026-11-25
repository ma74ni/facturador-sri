import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';

import { AuthService } from '../../application/services/auth.service';
import { SessionService } from '../../application/services/session.service';
import { AdminGuard } from '../../infrastructure/guards/admin.guard';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';

describe('AuthController: sesión que se renueva', () => {
  let app: INestApplication;
  const sessions = {
    start: jest.fn().mockResolvedValue({
      accessToken: 'acceso-corto',
      refreshToken: 'renovar-1',
      refreshExpiresAt: new Date(Date.now() + 86_400_000),
    }),
    refresh: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({ user: { id: 'u1' }, access_token: 'token-largo' }),
          },
        },
        { provide: SessionService, useValue: sessions },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('sin keepSession (el POS) responde como siempre y no pone cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({}).expect(201);

    expect(res.body.access_token).toBe('token-largo');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('con keepSession entrega el acceso corto y la cookie httpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ keepSession: true })
      .expect(201);

    expect(res.body.access_token).toBe('acceso-corto');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('fsri_refresh=renovar-1');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
  });

  it('renovar exige la cabecera de sesión (CSRF)', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'fsri_refresh=renovar-1')
      .expect(400);
    expect(sessions.refresh).not.toHaveBeenCalled();
  });

  it('renovar lee la cookie y la cambia por la nueva', async () => {
    sessions.refresh.mockResolvedValue({
      accessToken: 'acceso-2',
      refreshToken: 'renovar-2',
      refreshExpiresAt: new Date(Date.now() + 86_400_000),
    });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'fsri_refresh=renovar-1')
      .set('X-Facturador-Session', '1')
      .expect(200);

    expect(sessions.refresh).toHaveBeenCalledWith('renovar-1', undefined);
    expect(res.body).toEqual({ access_token: 'acceso-2' });
    expect(String(res.headers['set-cookie'])).toContain('fsri_refresh=renovar-2');
  });

  it('una renovación rechazada borra la cookie', async () => {
    sessions.refresh.mockRejectedValue(new UnauthorizedException('Sesión vencida'));

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Facturador-Session', '1')
      .expect(401);

    expect(String(res.headers['set-cookie'])).toMatch(/fsri_refresh=;/);
  });

  it('cerrar sesión revoca la sesión de la cookie y la borra', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'fsri_refresh=renovar-1')
      .set('X-Facturador-Session', '1')
      .expect(200);

    expect(sessions.end).toHaveBeenCalledWith('renovar-1');
    expect(String(res.headers['set-cookie'])).toMatch(/fsri_refresh=;/);
  });

  it('al iniciar sesión cierra la sesión que otro usuario dejó en el navegador', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Cookie', 'fsri_refresh=de-otro-usuario')
      .send({})
      .expect(201);

    expect(sessions.end).toHaveBeenCalledWith('de-otro-usuario');
    expect(String(res.headers['set-cookie'])).toMatch(/fsri_refresh=;/);
  });
});
