import type { AuditEntry } from "../../src/core/audit/audit.service.js";
import type { UserRole } from "../../src/core/auth/actor.js";
import type { VerifiedSession } from "../../src/core/auth/session-verifier.js";
import type { Tx } from "../../src/core/db/db.module.js";
import type { RequestContext } from "../../src/core/http/request-context.js";

/** Cookie → session. `session=<name>` selects a user below; "down" simulates an outage. */
const USERS: Record<string, { id: string; roles: UserRole[]; mfa: boolean }> = {
  alice: { id: "user-alice", roles: ["user"], mfa: true },
  bob: { id: "user-bob", roles: ["user"], mfa: true },
  admin: { id: "user-admin", roles: ["admin"], mfa: true },
  admin_no_mfa: { id: "user-admin-2", roles: ["admin"], mfa: false },
  supplier: { id: "user-supplier", roles: ["supplier"], mfa: true },
};

export class FakeSessionVerifier {
  async verify(cookie: string | undefined): Promise<VerifiedSession | null> {
    const name = cookie?.match(/(?:^|;\s*)session=([a-z_]+)/)?.[1];
    if (name === "down") throw new Error("auth backend down");
    const user = name ? USERS[name] : undefined;
    if (!user) return null;
    return { actor: { kind: "user", id: user.id, roles: user.roles }, staffMfaSatisfied: user.mfa };
  }
}

export const cookieFor = (name: keyof typeof USERS | "down" | "nobody") => `session=${name}`;

export class FakeAuditService {
  readonly entries: (AuditEntry & { actor: string; requestId: string })[] = [];

  async record(_tx: Tx, ctx: RequestContext, entry: AuditEntry): Promise<void> {
    this.entries.push({ ...entry, actor: `${ctx.actor.kind}:${ctx.actor.id}`, requestId: ctx.requestId });
  }
}

export const passThroughTransactions = {
  run: <T>(work: (tx: Tx) => Promise<T>) => work({} as Tx),
};
