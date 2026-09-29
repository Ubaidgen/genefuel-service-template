import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, describe, expect, it } from "vitest";
import { RedisThrottlerStorage } from "../../src/core/security/redis-throttler-storage.js";

const redis = new Redis("redis://127.0.0.1:63799", { maxRetriesPerRequest: 1 });
const storage = new RedisThrottlerStorage(redis, "int-test");

afterAll(async () => {
  await redis.quit();
});

describe("RedisThrottlerStorage (real Redis)", () => {
  it("counts hits and blocks once the limit is exceeded", async () => {
    const key = randomUUID();
    const hit = () => storage.increment(key, 60_000, 3, 30_000, "default");

    for (let i = 1; i <= 3; i++) {
      const r = await hit();
      expect(r).toMatchObject({ totalHits: i, isBlocked: false });
      expect(r.timeToExpire).toBeGreaterThan(55);
    }
    const blocked = await hit();
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(25);
    expect((await hit()).isBlocked).toBe(true);
  });

  it("is atomic under concurrency across 'instances'", async () => {
    const key = randomUUID();
    const other = new RedisThrottlerStorage(redis, "int-test");
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => (i % 2 ? storage : other).increment(key, 60_000, 20, 60_000, "default")),
    );
    expect(results.filter((r) => !r.isBlocked)).toHaveLength(20);
  });
});
