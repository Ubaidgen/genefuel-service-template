import type { ThrottlerStorage } from "@nestjs/throttler";
import type { Redis } from "ioredis";

/**
 * Shared fixed-window rate-limit store, so limits hold across every instance.
 * One atomic Lua script per hit: count, expire, and block once over the limit.
 * Return values follow @nestjs/throttler's in-memory store (times in seconds).
 */
const INCREMENT_SCRIPT = `
local hitsKey, blockKey = KEYS[1], KEYS[2]
local ttl, limit, block = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return { limit + 1, math.max(redis.call('PTTL', hitsKey), 0), 1, blockTtl }
end
local hits = redis.call('INCR', hitsKey)
if hits == 1 then redis.call('PEXPIRE', hitsKey, ttl) end
local hitsTtl = redis.call('PTTL', hitsKey)
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', block)
  return { hits, hitsTtl, 1, block }
end
return { hits, hitsTtl, 0, 0 }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const base = `${this.prefix}:rl:${throttlerName}:${key}`;
    const [totalHits, hitsTtlMs, blocked, blockTtlMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${base}:hits`,
      `${base}:block`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: Math.ceil(hitsTtlMs / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
    };
  }
}
