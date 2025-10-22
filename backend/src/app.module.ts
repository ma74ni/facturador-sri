import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { EstablishmentsModule } from './modules/establishments/establishments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CreditNotesModule } from './modules/credit-notes/credit-notes.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { SharedModule } from './shared/shared.module';
import { EmailModule } from './shared/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SharedModule,
    EmailModule,
    AuthModule,
    CustomersModule,
    ProductsModule,
    EstablishmentsModule,
    InvoicesModule,
    CreditNotesModule,
    CompaniesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}