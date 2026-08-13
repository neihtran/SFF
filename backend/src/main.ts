import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Bảo mật HTTP headers
  app.use(helmet());

  // CORS — chỉ cho phép domain frontend + mobile thật
  app.enableCors({
    origin: [cfg.getOrThrow('FRONTEND_URL')],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ValidationPipe global — class-validator + class-transformer
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI
  const swaggerCfg = new DocumentBuilder()
    .setTitle('SFF API')
    .setDescription(
      'Say For Fun — Backend API (NestJS + Prisma + Supabase + Gemini + LiveKit)',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('api/docs', app, document);

  const port = cfg.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`SFF API listening on http://localhost:${port}`);
  logger.log(`Swagger docs at   http://localhost:${port}/api/docs`);
}

void bootstrap();
