import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Configurar CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Configurar prefix global de API
  app.setGlobalPrefix('api/v1');

  // Configurar validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configurar Swagger
  const config = new DocumentBuilder()
    .setTitle('POS Backend API')
    .setDescription('API del sistema POS para heladerías')
    .setVersion('1.0')
    .addTag('locales', 'Gestión de locales/puntos de venta')
    .addTag('colaboradores', 'Gestión de colaboradores')
    .addTag('turnos', 'Gestión de turnos y cajas')
    .addTag('productos', 'Gestión de productos y categorías')
    .addTag('orders', 'Gestión de órdenes (core del POS)')
    .addTag('delivery', 'Gestión de deliveries')
    .addTag('facturacion', 'Integración con facturación')
    .addTag('printing', 'Sistema de impresión')
    .addTag('reportes', 'Reportes y dashboards')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 POS Backend running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
