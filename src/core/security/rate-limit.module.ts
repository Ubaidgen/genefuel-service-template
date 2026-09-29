import { Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { Redis } from "ioredis";
import { ENV, type Env } from "../../config/env.js";
import { RedisThrottlerStorage } from "./redis-throttler-storage.js";

@Injectable()
export class RateLimitRedis implements OnApplicationShutdown {
  readonly client: Redis | null;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.REDIS_URL
      ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false })
      : null;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.quit();
  }
}

@Module({ providers: [RateLimitRedis], exports: [RateLimitRedis] })
class RateLimitRedisModule {}

/**
 * Global default: RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS per client IP
 * (IP resolved through TRUST_PROXY_HOPS). Tighten per route with
 *   @Throttle({ default: { limit: 10, ttl: 60_000 } })
 * and exempt only health probes with @SkipThrottle().
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RateLimitRedisModule],
      inject: [ENV, RateLimitRedis],
      useFactory: (env: Env, redis: RateLimitRedis) => ({
        throttlers: [{ name: "default", ttl: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX }],
        storage: redis.client ? new RedisThrottlerStorage(redis.client, env.SERVICE_NAME) : undefined,
      }),
    }),
  ],
})
export class RateLimitModule {}
