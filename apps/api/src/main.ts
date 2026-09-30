import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { assertStorageConfiguration } from './storage/storage.service.js';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  if (isProduction) {
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) throw new Error('JWT_ACCESS_SECRET must be at least 32 characters in production');
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL must be configured in production');
    try { if (new URL(webOrigin).protocol !== 'https:') throw new Error('WEB_ORIGIN must use HTTPS in production'); } catch { throw new Error('WEB_ORIGIN must be a valid HTTPS origin in production'); }
  }
  assertStorageConfiguration();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.headers['x-request-id'];
    const requestId = typeof supplied === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3003);

  await app.listen(port);

  console.log(`ICR Platform API listening on port ${port}`);
}

await bootstrap();
