import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { AuthService } from '../../application/services/auth.service';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/guards/admin.guard';
import { AuthController } from './auth.controller';

describe('AuthController: límite de intentos', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Mismo límite por defecto que AuthModule.
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({ ok: true }),
            forgotPassword: jest.fn().mockResolvedValue({ ok: true }),
            getProfile: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { userId: 'u1' };
          return true;
        },
      })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('corta el login en el intento 11 del mismo minuto', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post('/auth/login').send({}).expect(201);
    }
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);
  });

  it('las rutas que envían emails admiten solo 5 intentos', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/auth/forgot-password').send({}).expect(200);
    }
    await request(app.getHttpServer()).post('/auth/forgot-password').send({}).expect(429);
  });

  it('el perfil de un usuario autenticado no tiene límite', async () => {
    for (let i = 0; i < 15; i++) {
      await request(app.getHttpServer()).get('/auth/profile').expect(200);
    }
  });
});
