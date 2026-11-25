import { Module } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { DocumentEventsService } from './application/document-events.service';
import {
  CreditNoteHistoryController,
  IncidentsController,
  InvoiceHistoryController,
} from './presentation/document-history.controller';

@Module({
  controllers: [InvoiceHistoryController, CreditNoteHistoryController, IncidentsController],
  providers: [DocumentEventsService, PrismaService],
  exports: [DocumentEventsService],
})
export class DocumentEventsModule {}
