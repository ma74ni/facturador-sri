import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { ReceivedDocumentsService } from '../../application/services/received-documents.service';
import { ReceivedDocumentsSriService } from '../../application/services/received-documents-sri.service';
import { ReceivedDocumentsImportService } from '../../application/services/received-documents-import.service';
import { ReceivedDocumentsController } from './received-documents.controller';

describe('ReceivedDocumentsController: límite de consultas al SRI', () => {
  let app: INestApplication;
  let companyId = 'c-1';

  beforeEach(async () => {
    // Mismo límite por defecto que AuthModule (el ThrottlerModule es global).
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [ReceivedDocumentsController],
      providers: [
        {
          provide: ReceivedDocumentsService,
          useValue: { findAll: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ReceivedDocumentsSriService,
          useValue: { lookup: jest.fn().mockResolvedValue({ alreadyRegistered: false }) },
        },
        { provide: ReceivedDocumentsImportService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { userId: 'u-1', companyId };
          return true;
        },
      })
      .overrideGuard(EmailVerifiedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequireModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    companyId = 'c-1';
  });

  afterEach(() => app.close());

  it('corta la consulta 21 del minuto de una empresa, sin afectar a otra', async () => {
    const lookup = () =>
      request(app.getHttpServer()).post('/received-documents/lookup').send({ accessKey: '1' });
    for (let i = 0; i < 20; i++) {
      await lookup().expect(200);
    }
    await lookup().expect(429);

    companyId = 'c-2';
    await lookup().expect(200);
  });

  it('la lista de compras no tiene ese límite', async () => {
    for (let i = 0; i < 25; i++) {
      await request(app.getHttpServer()).get('/received-documents').expect(200);
    }
  });
});
