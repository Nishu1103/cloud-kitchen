import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ERROR_CODES } from '@ck/types';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppException } from './common/exceptions/app.exception';
import { loadAppConfig } from './config/load';

async function bootstrap(): Promise<void> {
  // Configuration is validated before Nest starts: a bad secret fails at boot, not at 3am.
  const config = loadAppConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // The gateway/webhook needs the exact bytes; see the raw-body wiring below.
    rawBody: false,
  });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  app.setGlobalPrefix(config.http.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Trust exactly as many proxy hops as we actually run (Nginx = 1). Without this,
  // `req.ip` is the proxy's address and every rate limit becomes global, not per client.
  app.set('trust proxy', config.http.trustProxyHops);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Only meaningful over HTTPS, and only safe once the domain is HTTPS-only.
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.use(compression());
  app.use(cookieParser());

  /**
   * A gateway signature is an HMAC over the exact bytes sent, and `JSON.parse` then
   * re-serialising loses those bytes (key order, whitespace, unicode escapes). So the
   * webhook route - and only that route - keeps the original buffer alongside the
   * parsed body, which is what the signature check reads.
   */
  const webhookPath = `/${config.http.globalPrefix}/v1/webhooks/`;
  app.use(
    express.json({
      limit: '1mb',
      verify: (request, _response, buffer) => {
        if (request.url?.startsWith(webhookPath)) {
          (request as { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  /**
   * The four portals are separate origins. Only they may send credentials, and the
   * allow-list is configuration - no wildcard, and no reflecting an arbitrary Origin.
   */
  app.enableCors({
    origin(origin, callback) {
      if (!origin || config.http.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Campus-Slug',
      'X-Portal',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not on the DTO is stripped, and sending it is an error - this is what
      // stops a client from smuggling `role` or `price` into a request body.
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
      exceptionFactory: (errors) => {
        const details: Record<string, string[]> = {};
        const walk = (list: typeof errors, prefix = ''): void => {
          for (const error of list) {
            const path = prefix ? `${prefix}.${error.property}` : error.property;
            if (error.constraints) details[path] = Object.values(error.constraints);
            if (error.children?.length) walk(error.children, path);
          }
        };
        walk(errors);
        return AppException.badRequest(
          ERROR_CODES.VALIDATION_FAILED,
          'Some details need fixing.',
          details,
        );
      },
    }),
  );

  app.enableShutdownHooks();

  // Docs are useful in development and a reconnaissance gift in production.
  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Campus Kitchen API')
        .setDescription('Multi-tenant food commerce platform')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth('ck_at')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.http.port, '0.0.0.0');
}

void bootstrap();
