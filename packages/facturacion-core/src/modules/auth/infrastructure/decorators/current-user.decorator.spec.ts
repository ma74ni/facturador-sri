import { CanActivate, Controller, ExecutionContext, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthenticatedUser, CurrentUser } from './current-user.decorator';

const user: AuthenticatedUser = { userId: 'u1', email: 'ana@empresa.ec', companyId: 'c1' };

// Hace lo mismo que JwtAuthGuard: deja el usuario validado en req.user.
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = user;
    return true;
  }
}

@Controller('yo')
class MeController {
  @Get()
  me(@CurrentUser() current: AuthenticatedUser) {
    return current;
  }
}

describe('@CurrentUser', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: APP_GUARD, useClass: FakeJwtGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('entrega al handler el usuario autenticado con su empresa', async () => {
    await request(app.getHttpServer()).get('/yo').expect(200, user);
  });
});
