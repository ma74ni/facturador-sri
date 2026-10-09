import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailModule } from '@/shared/email/email.module';
import { EmailService } from '@/shared/email/email.service';
import { MailjetProvider } from '@/shared/email/providers/mailjet.provider';
import { PlatformAdminModule } from './platform-admin.module';
import { PlatformCompaniesController } from './presentation/controllers/platform-companies.controller';
import { PlatformAdminsController } from './presentation/controllers/platform-admins.controller';

describe('PlatformAdminModule', () => {
  it('resuelve sus controladores y servicios', async () => {
    // Config y EmailModule son globales en AppModule; aquí se importan igual.
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), EmailModule, PlatformAdminModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(MailjetProvider)
      .useValue({})
      .overrideProvider(EmailService)
      .useValue({ sendEmail: jest.fn() })
      .compile();

    expect(moduleRef.get(PlatformCompaniesController)).toBeDefined();
    expect(moduleRef.get(PlatformAdminsController)).toBeDefined();
  });
});
