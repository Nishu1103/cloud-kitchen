import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { CONFIG, type AppConfig } from '@/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly clients: Redis[] = [];
  readonly client: Redis;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.client = this.createClient('primary');
  }

  /**
   * BullMQ and the Socket.IO adapter each need their own connection because they
   * put it into blocking/subscriber mode.
   */
  createClient(name: string): Redis {
    const options: RedisOptions = {
      password: this.config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectionName: `ck-${name}`,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
      ...(this.config.redis.tls ? { tls: {} } : {}),
    };
    const client = new Redis(this.config.redis.url, options);
    client.on('error', (error) => this.logger.error(`Redis (${name}) error: ${error.message}`));
    this.clients.push(client);
    return client;
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A poisoned cache entry must never take down a request path.
      await this.client.del(key);
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds) await this.client.set(key, payload, 'EX', ttlSeconds);
    else await this.client.set(key, payload);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /** Marks a key present for a bounded window; used for revocation lists. */
  async setFlag(key: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }

  /** Atomic counter that expires as a whole window (login attempts, quotas). */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.client
      .multi()
      .incr(key)
      .expire(key, ttlSeconds, 'NX')
      .exec();
    const count = results?.[0]?.[1];
    return typeof count === 'number' ? count : 0;
  }

  /** Distributed single-use lock. Returns null when the lock is already held. */
  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = Math.random().toString(36).slice(2);
    const result = await this.client.set(`lock:${key}`, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    // Compare-and-delete so a slow holder cannot release someone else's lock.
    await this.client.eval(
      `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
      1,
      `lock:${key}`,
      token,
    );
  }

  /** Non-blocking pattern delete. Never use KEYS against a production instance. */
  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) deleted += await this.client.del(...keys);
    } while (cursor !== '0');
    return deleted;
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.clients.map((client) => client.quit()));
  }
}
