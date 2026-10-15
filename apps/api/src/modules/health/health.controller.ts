import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '@/common/decorators';
import { SKIP_ALL_THROTTLERS } from '@/common/throttler/named-throttler';
import { RedisService } from '@/modules/redis/redis.service';

/**
 * Two probes, on purpose.
 *
 * `/live` answers as long as the process is up - Kubernetes restarts the pod if it stops.
 * `/ready` also checks Mongo and Redis, so the load balancer stops sending traffic to an
 * instance that cannot serve it. Neither leaks version or dependency detail publicly.
 */
@ApiExcludeController()
@Controller('health')
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @Public()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async ready() {
    const [mongo, redis] = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const healthy = mongo && redis;
    return {
      status: healthy ? 'ok' : 'degraded',
      checks: { mongo: mongo ? 'up' : 'down', redis: redis ? 'up' : 'down' },
    };
  }

  private async checkMongo(): Promise<boolean> {
    try {
      await this.connection.db?.admin().ping();
      return this.connection.readyState === 1;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
