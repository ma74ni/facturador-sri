import { Module } from '@nestjs/common';
import { CustomersController } from './presentation/controllers/customers.controller';
import { CustomersService } from './application/services/customers.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PrismaService],
  exports: [CustomersService],
})
export class CustomersModule {}