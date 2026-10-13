import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { isAllowedOrigin, parseCorsOrigins } from './shared/http/cors-origins';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: solo la web del facturador. Sin CORS_ORIGIN queda abierto (desarrollo).
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (corsOrigins.length === 0) {
    Logger.warn('CORS_ORIGIN vacío: la API acepta llamadas desde cualquier origen', 'CORS');
    app.enableCors();
  } else {
    app.enableCors({
      // Un origen no permitido recibe la respuesta sin cabeceras CORS y el navegador la bloquea.
      origin: (origin, callback) =>
        callback(null, !origin || isAllowedOrigin(origin, corsOrigins)),
    });
  }

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Facturador Electrónico SRI API')
    .setDescription('API para Sistema de Facturación Electrónica')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log('');
  console.log('🚀 ===================================');
  console.log(`🔗 URL: http://localhost:${port}/api/v1`);
  console.log(`📚 Docs: http://localhost:${port}/api/docs`);
  console.log('====================================');
  console.log('');
   
  
}

bootstrap();