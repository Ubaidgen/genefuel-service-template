import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { desc, sql } from "drizzle-orm";
import { actorRef } from "../auth/actor.js";
import type { Tx } from "../db/db.module.js";
import type { RequestContext } from "../http/request-context.js";
import { type AuditMetadata, auditEvents } from "./audit.schema.js";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

export interface AuditEntry {
  /** "<resource>.<verb>", e.g. "example.created", "example.read_by_staff". */
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: AuditMetadata;
}

export interface AuditRecord extends Required<AuditEntry> {
  occurredAt: Date;
  actor: string;
  requestId: string | null;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export function computeAuditHash(prevHash: string, record: AuditRecord): string {
  return createHash("sha256")
    .update(prevHash)
    .update(canonical({ ...record, occurredAt: record.occurredAt.toISOString() }))
    .digest("hex");
}

@Injectable()
export class AuditService {
  /**
   * Write inside the SAME transaction as the change it describes, so a change
   * never commits without its audit row (and vice versa).
   */
  async record(tx: Tx, ctx: RequestContext, entry: AuditEntry): Promise<void> {
    // Serialise appends so every row chains to exactly one predecessor.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('audit_events'))`);
    const [last] = await tx
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .orderBy(desc(auditEvents.seq))
      .limit(1);

    const record: AuditRecord = {
      occurredAt: new Date(),
      actor: actorRef(ctx.actor),
      requestId: ctx.requestId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? {},
    };
    const prevHash = last?.hash ?? AUDIT_GENESIS_HASH;
    await tx.insert(auditEvents).values({ ...record, prevHash, hash: computeAuditHash(prevHash, record) });
  }
}
