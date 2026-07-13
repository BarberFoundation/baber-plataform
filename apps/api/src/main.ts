import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/kernel/errors/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  const corsOrigins = config
    .get<string>('CORS_ORIGINS')
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    // Produção sem CORS_ORIGINS definido = nenhuma origem cross-site permitida.
    // Dev sem CORS_ORIGINS = reflete qualquer origem (localhost com portas variadas).
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : !isProd,
    credentials: true,
  });
  app.enableShutdownHooks();

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Baber API')
      .setDescription('API da plataforma de barbearia (multi-tenant).')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`API on port ${port}${!isProd ? ' | docs em /docs' : ''} | health em /health`);
}

void bootstrap();
