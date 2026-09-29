import { describe, expect, it } from "vitest";
import { AUDIT_GENESIS_HASH, type AuditRecord, computeAuditHash } from "../../src/core/audit/audit.service.js";

const record: AuditRecord = {
  occurredAt: new Date("2026-09-28T10:00:00Z"),
  actor: "user:u1",
  requestId: "req-1",
  action: "example.created",
  resourceType: "example",
  resourceId: "e1",
  metadata: { b: 1, a: true },
};

describe("audit hash chain", () => {
  it("is deterministic regardless of metadata key order", () => {
    const reordered = { ...record, metadata: { a: true, b: 1 } };
    expect(computeAuditHash(AUDIT_GENESIS_HASH, record)).toBe(computeAuditHash(AUDIT_GENESIS_HASH, reordered));
  });

  it("changes when any field or the previous hash changes", () => {
    const base = computeAuditHash(AUDIT_GENESIS_HASH, record);
    expect(computeAuditHash(AUDIT_GENESIS_HASH, { ...record, actor: "user:u2" })).not.toBe(base);
    expect(computeAuditHash(AUDIT_GENESIS_HASH, { ...record, metadata: { a: false, b: 1 } })).not.toBe(base);
    expect(computeAuditHash("f".repeat(64), record)).not.toBe(base);
  });
});
