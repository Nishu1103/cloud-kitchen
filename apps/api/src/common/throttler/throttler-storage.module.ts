import { Module } from '@nestjs/common';
import { RedisModule } from '@/modules/redis/redis.module';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Exists so `ThrottlerModule.forRootAsync` can inject the storage: a dynamic
 * module can only resolve providers from its own `imports` or from global ones.
 */
@Module({
  imports: [RedisModule],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
