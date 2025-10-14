import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { EstablishmentsModule } from './modules/establishments/establishments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    CustomersModule,
    ProductsModule,
    EstablishmentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}