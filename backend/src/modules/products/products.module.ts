import { Module } from '@nestjs/common';
import { ProductsController } from './presentation/controllers/products.controller';
import { ProductsService } from './application/services/products.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
  exports: [ProductsService],
})
export class ProductsModule {}