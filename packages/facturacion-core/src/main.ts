// Primero: Sentry debe cargarse antes que Express y Nest.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isAllowedOrigin, parseCorsOrigins } from './shared/http/cors-origins';

const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render pone un proxy delante: sin esto todas las peticiones llegan con su IP
  // y el límite de intentos de auth bloquearía a todos los usuarios a la vez.
  app.set('trust proxy', 1);

  // Swagger UI usa scripts inline que la CSP de helmet bloquea; solo existe fuera de producción.
  const swaggerEnabled = !isProduction || process.env.SWAGGER_ENABLED === 'true';
  app.use(helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }));

  // CORS: solo la web del facturador. Sin CORS_ORIGIN queda abierto (solo desarrollo).
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (corsOrigins.length === 0) {
    if (isProduction) {
      throw new Error('Falta CORS_ORIGIN: en producción la API no acepta cualquier origen');
    }
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

  // Swagger: expone el mapa completo de la API, así que en producción se activa solo con SWAGGER_ENABLED=true.
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Facturador Electrónico SRI API')
      .setDescription('API para Sistema de Facturación Electrónica')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(`API en http://localhost:${port}/api/v1`, 'Bootstrap');
  if (swaggerEnabled) {
    Logger.log(`Docs en http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

bootstrap();
