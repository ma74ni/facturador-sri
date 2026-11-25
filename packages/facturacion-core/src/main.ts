// Primero: Sentry debe cargarse antes que Express y Nest.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { allowsCredentials, isAllowedOrigin, parseCorsOrigins } from './shared/http/cors-origins';
import { JsonLogger, useJsonLogs } from './shared/observability/json-logger';
import { requestContextMiddleware } from './shared/observability/request-context.middleware';

const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // En producción, logs en JSON con el id de la petición y la empresa (ver JsonLogger).
  if (useJsonLogs()) app.useLogger(new JsonLogger());

  // Primero de todo: cada petición recibe su id y su contexto (logs, Sentry, "código" del error).
  app.use(requestContextMiddleware);

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
  }
  // Por petición: la cookie de renovación de sesión (credenciales) solo para los orígenes
  // exactos con https (ver allowsCredentials); el resto de la lista, sin credenciales.
  app.enableCors((req: { headers: { origin?: string } }, callback) => {
    const origin = req.headers.origin;
    const allowed = !origin || corsOrigins.length === 0 || isAllowedOrigin(origin, corsOrigins);
    callback(null, {
      // Un origen no permitido recibe la respuesta sin cabeceras CORS y el navegador la bloquea.
      origin: allowed,
      credentials: !!origin && allowed && allowsCredentials(origin, corsOrigins),
    });
  });

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
