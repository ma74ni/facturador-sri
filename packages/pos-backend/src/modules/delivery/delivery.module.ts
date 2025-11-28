import { Module } from '@nestjs/common';
import { DeliveryController } from './presentation/controllers/delivery.controller';
import { DeliveryService } from './application/services/delivery.service';

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
