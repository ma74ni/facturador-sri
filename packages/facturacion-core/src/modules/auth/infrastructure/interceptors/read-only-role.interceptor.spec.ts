import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Post,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { READ_ONLY_MESSAGE, ReadOnlyRoleInterceptor } from './read-only-role.interceptor';

let role: string | null = 'VIEWER';

// Como JwtAuthGuard: deja el usuario en req.user (o nada, en una ruta pública).
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    if (role) ctx.switchToHttp().getRequest().user = { userId: 'u1', companyId: 'c1', role };
    return true;
  }
}

@Controller()
class SampleController {
  @Get('invoices')
  list() {
    return [];
  }

  @Post('invoices')
  create() {
    return { id: 'i1' };
  }

  @Post('auth/logout')
  logout() {
    return { ok: true };
  }
}

describe('el contador solo lee', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleController],
      providers: [
        { provide: APP_GUARD, useClass: FakeJwtGuard },
        { provide: APP_INTERCEPTOR, useClass: ReadOnlyRoleInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(() => app.close());

  it('puede ver, pero no crear, editar ni borrar (403 con un mensaje claro)', async () => {
    role = 'VIEWER';
    await request(app.getHttpServer()).get('/api/v1/invoices').expect(200);
    const response = await request(app.getHttpServer()).post('/api/v1/invoices').expect(403);
    expect(response.body.message).toBe(READ_ONLY_MESSAGE);
  });

  it('los demás roles, y las rutas sin usuario, no cambian', async () => {
    for (const other of ['ADMIN', 'USER', 'MANAGER', null]) {
      role = other;
      await request(app.getHttpServer()).post('/api/v1/invoices').expect(201);
    }
  });
});
