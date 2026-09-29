import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type AuditMetadata = Record<string, string | number | boolean | null>;

/**
 * Append-only, hash-chained audit trail. UPDATE/DELETE are blocked by a
 * trigger (see drizzle/*_audit_events_immutable.sql). `metadata` must never
 * hold PII or health data — IDs, counts, enum values only.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    requestId: text("request_id"),
    metadata: jsonb("metadata").$type<AuditMetadata>().notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull().unique(),
  },
  (t) => [index("audit_events_resource_idx").on(t.resourceType, t.resourceId)],
);
