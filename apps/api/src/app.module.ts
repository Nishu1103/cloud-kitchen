import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from '@/common/guards/app-throttler.guard';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { FeatureFlagGuard } from '@/common/guards/feature-flag.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PortalGuard } from '@/common/guards/portal.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { RequestContextMiddleware } from '@/common/middleware/request-context.middleware';
import { SanitizeMiddleware } from '@/common/middleware/sanitize.middleware';
import { skipUnlessNamedThrottle } from '@/common/throttler/named-throttler';
import { RedisThrottlerStorage } from '@/common/throttler/redis-throttler.storage';
import { ThrottlerStorageModule } from '@/common/throttler/throttler-storage.module';
import { TenantModule } from '@/common/tenant/tenant.module';
import { AppConfigModule, CONFIG, type AppConfig } from '@/config';
import { DatabaseModule } from '@/database/database.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CampusesModule } from '@/modules/campuses/campuses.module';
import { CartModule } from '@/modules/cart/cart.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { ContentModule } from '@/modules/content/content.module';
import { CouponsModule } from '@/modules/coupons/coupons.module';
import { DeliveryModule } from '@/modules/delivery/delivery.module';
import { HealthModule } from '@/modules/health/health.module';
import { MailModule } from '@/modules/mail/mail.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { PlatformModule } from '@/modules/platform/platform.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { UploadsModule } from '@/modules/uploads/uploads.module';
import { UsersModule } from '@/modules/users/users.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { WalletModule } from '@/modules/wallet/wallet.module';

/**
 * The composition root.
 *
 * Guard order below is the security pipeline and it is deliberate:
 *   throttle → authenticate → CSRF → portal → tenant → permissions → feature flag.
 * Rate limiting runs before any database work; identity is established before anything
 * is authorised; tenancy is pinned before a permission is evaluated. Every one of these
 * is global, so a new controller is protected by default and has to opt out explicitly.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          // Correlates every log line of a request, and is echoed to the client.
          genReqId: (req) => (req as { requestId?: string }).requestId ?? crypto.randomUUID(),
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
          // Nothing that could carry a credential or personal data reaches the log.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-csrf-token"]',
              'req.headers["x-webhook-signature"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.otp',
              'req.body.token',
              'res.headers["set-cookie"]',
            ],
            censor: '[redacted]',
          },
        },
      }),
    }),
    EventEmitterModule.forRoot({ maxListeners: 30, verboseMemoryLeak: !process.env.NODE_ENV }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [CONFIG, RedisThrottlerStorage],
      useFactory: (config: AppConfig, storage: RedisThrottlerStorage) => ({
        throttlers: [
          { name: 'default', limit: config.rateLimit.limit, ttl: config.rateLimit.windowMs },
          // Named limiters are opt-in via `@Throttle({ auth|checkout|webhook })`.
          // Without skipIf they would cap every route at 10/min (the 429 on unread-count).
          { name: 'auth', limit: 10, ttl: 60_000, skipIf: skipUnlessNamedThrottle('auth') },
          { name: 'checkout', limit: 10, ttl: 60_000, skipIf: skipUnlessNamedThrottle('checkout') },
          { name: 'webhook', limit: 120, ttl: 60_000, skipIf: skipUnlessNamedThrottle('webhook') },
        ],
        storage,
      }),
    }),

    DatabaseModule,
    RedisModule,
    TenantModule,
    QueueModule,
    MailModule,
    AuditModule,
    RbacModule,
    AuthModule,
    PlatformModule,
    NotificationsModule,
    UploadsModule,

    CampusesModule,
    UsersModule,
    VendorsModule,
    CatalogModule,
    CouponsModule,
    CartModule,
    WalletModule,
    PaymentsModule,
    DeliveryModule,
    OrdersModule,
    ReviewsModule,
    ContentModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    // JWT first so the throttler can key signed-in traffic by user. Running it
    // before auth made every portal on a campus NAT (and all four local apps on
    // 127.0.0.1) share one bucket — that is the unread-count 429.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PortalGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeatureFlagGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, SanitizeMiddleware).forRoutes('*');
  }
}
