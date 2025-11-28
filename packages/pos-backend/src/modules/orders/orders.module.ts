import { Module } from '@nestjs/common';
import { OrdersController } from './presentation/controllers/orders.controller';
import { OrdersService } from './application/services/orders.service';
import { OrderPaymentService } from './application/services/order-payment.service';
import { OrderCalculatorService } from './domain/services/order-calculator.service';
import { OrderValidatorService } from './domain/services/order-validator.service';
import { ProductosModule } from '../productos/productos.module';
import { TurnosModule } from '../turnos/turnos.module';

@Module({
  imports: [ProductosModule, TurnosModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderPaymentService,
    OrderCalculatorService,
    OrderValidatorService,
  ],
  exports: [OrdersService, OrderPaymentService],
})
export class OrdersModule {}
