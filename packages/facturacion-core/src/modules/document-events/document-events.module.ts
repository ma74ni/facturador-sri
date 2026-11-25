import { Module } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { PlansModule } from '../plans/plans.module';
import { DocumentEventsService } from './application/document-events.service';
import { IncidentDigestService } from './application/incident-digest.service';
import {
  CreditNoteHistoryController,
  IncidentsController,
  InvoiceHistoryController,
} from './presentation/document-history.controller';

@Module({
  imports: [PlansModule],
  controllers: [InvoiceHistoryController, CreditNoteHistoryController, IncidentsController],
  providers: [DocumentEventsService, IncidentDigestService, PrismaService],
  exports: [DocumentEventsService],
})
export class DocumentEventsModule {}
