import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './shared/config/config.module';
import { PrismaModule } from './shared/prisma/prisma.module';

// Módulos de negocio
import { LocalesModule } from './modules/locales/locales.module';
import { ColaboradoresModule } from './modules/colaboradores/colaboradores.module';
import { TurnosModule } from './modules/turnos/turnos.module';
import { ProductosModule } from './modules/productos/productos.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PrintingModule } from './modules/printing/printing.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    // Configuración global
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),

    // Módulos de negocio
    LocalesModule,
    ColaboradoresModule,
    TurnosModule,
    ProductosModule,
    OrdersModule,
    PrintingModule,
    DeliveryModule,
    FacturacionModule,
    ReportesModule,
  ],
})
export class AppModule {}
