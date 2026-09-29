import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseEnv } from "../../../src/config/env.js";
import { AUDIT_GENESIS_HASH, AuditService, computeAuditHash } from "../../../src/core/audit/audit.service.js";
import { createPool, type Db, TransactionRunner } from "../../../src/core/db/db.module.js";
import type { RequestContext } from "../../../src/core/http/request-context.js";
import { FieldCrypto } from "../../../src/core/security/field-crypto.js";
import { MAX_ACTIVE_EXAMPLES_PER_OWNER } from "../../../src/modules/example/domain/example-policy.js";
import { ExampleLimitReachedError } from "../../../src/modules/example/errors.js";
import { ExampleRepository } from "../../../src/modules/example/persistence/example.repository.js";
import { examples } from "../../../src/modules/example/persistence/example.schema.js";
import { CreateExampleUseCase } from "../../../src/modules/example/use-cases/create-example.use-case.js";
import { integrationEnv } from "../../helpers/test-env.js";

/**
 * Real Postgres: encryption at rest, audit chain + immutability, and the
 * race-safety of the per-owner limit. Schema is migrated by integration-setup.ts.
 */
const env = parseEnv(integrationEnv);
let pool: Pool;
let db: Db;
let create: CreateExampleUseCase;

const ctx = (userId: string): RequestContext => ({
  actor: { kind: "user", id: userId, roles: ["user"] },
  requestId: `req-${randomUUID()}`,
});
const ownerId = () => `user-${randomUUID()}`;

beforeAll(() => {
  pool = createPool(env);
  db = drizzle(pool);
  create = new CreateExampleUseCase(
    new ExampleRepository(db, new FieldCrypto(env)),
    new TransactionRunner(db),
    new AuditService(),
  );
});

afterAll(async () => {
  await pool?.end();
});

describe("example persistence (real Postgres)", () => {
  it("stores the note encrypted and returns it decrypted", async () => {
    const dto = await create.execute(ctx(ownerId()), { title: "t", note: "HbA1c 5.9%" });
    expect(dto.note).toBe("HbA1c 5.9%");

    const [row] = await db.select({ stored: examples.noteCiphertext }).from(examples).where(eq(examples.id, dto.id));
    expect(row?.stored).toMatch(/^enc:v1:/);
    expect(row?.stored).not.toContain("HbA1c");
  });

  it("chains every audit row to its predecessor", async () => {
    const owner = ownerId();
    await create.execute(ctx(owner), { title: "a", note: null });
    await create.execute(ctx(owner), { title: "b", note: null });

    const { rows } = await pool.query("select * from audit_events order by seq");
    let prev = AUDIT_GENESIS_HASH;
    for (const r of rows) {
      expect(r.prev_hash).toBe(prev);
      const expected = computeAuditHash(prev, {
        occurredAt: r.occurred_at,
        actor: r.actor,
        requestId: r.request_id,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata: r.metadata,
      });
      expect(r.hash).toBe(expected);
      prev = r.hash;
    }
  });

  it("blocks UPDATE, DELETE and TRUNCATE on audit_events", async () => {
    await create.execute(ctx(ownerId()), { title: "a", note: null });
    await expect(pool.query("update audit_events set actor = 'x'")).rejects.toThrow(/append-only/);
    await expect(pool.query("delete from audit_events")).rejects.toThrow(/append-only/);
    await expect(pool.query("truncate audit_events")).rejects.toThrow(/append-only/);
  });

  it("holds the active limit under concurrent requests (advisory lock)", async () => {
    const owner = ownerId();
    const results = await Promise.allSettled(
      Array.from({ length: MAX_ACTIVE_EXAMPLES_PER_OWNER * 2 }, (_, i) =>
        create.execute(ctx(owner), { title: `r${i}`, note: null }),
      ),
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(results.length - rejected.length).toBe(MAX_ACTIVE_EXAMPLES_PER_OWNER);
    for (const r of rejected) expect(r.reason).toBeInstanceOf(ExampleLimitReachedError);

    const [row] = await db.select({ n: count() }).from(examples).where(eq(examples.ownerId, owner));
    expect(row?.n).toBe(MAX_ACTIVE_EXAMPLES_PER_OWNER);
  });
});
