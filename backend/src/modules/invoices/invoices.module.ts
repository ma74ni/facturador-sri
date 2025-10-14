import { Module } from '@nestjs/common';
import { InvoicesController } from './presentation/controllers/invoices.controller';
import { InvoicesService } from './application/services/invoices.service';
import { AccessKeyService } from './domain/services/access-key.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, AccessKeyService, PrismaService],
  exports: [InvoicesService],
})
export class InvoicesModule {}