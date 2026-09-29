import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { ENV, type Env } from "../../config/env.js";
import { USER_ROLES, type UserActor, type UserRole } from "./actor.js";

/** Subset of genefuel-web-app `GET /api/auth/me` that this service relies on. */
const AuthMeResponse = z.object({
  user: z.object({
    id: z.string().min(1),
    roles: z.array(z.string()).default([]),
  }),
  staffMfa: z
    .object({
      required: z.boolean(),
      sessionVerified: z.boolean(),
      enforcementActive: z.boolean().optional(),
    })
    .nullish(),
});

export interface VerifiedSession {
  actor: UserActor;
  /** False when staff MFA is enforced for this user but not completed in this session. */
  staffMfaSatisfied: boolean;
}

/**
 * Verifies a member/staff session by forwarding the caller's cookie to
 * genefuel-web-app. The session store stays owned by the web-app; this service
 * never reads session tables or holds the Better Auth secret.
 */
@Injectable()
export class SessionVerifier {
  private readonly logger = new Logger(SessionVerifier.name);
  private readonly cache = new Map<string, { value: VerifiedSession; expiresAt: number }>();
  private static readonly MAX_CACHE_ENTRIES = 10_000;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Returns null for "not signed in"; throws only when the auth backend is unreachable. */
  async verify(cookieHeader: string | undefined): Promise<VerifiedSession | null> {
    if (!cookieHeader) return null;

    const key = createHash("sha256").update(cookieHeader).digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const res = await fetch(new URL("/api/auth/me", this.env.AUTH_BASE_URL), {
      headers: { cookie: cookieHeader, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(this.env.AUTH_TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`auth backend responded ${res.status}`);
    }

    const parsed = AuthMeResponse.safeParse(await res.json());
    if (!parsed.success) {
      this.logger.error("auth backend returned an unexpected /api/auth/me shape");
      throw new Error("auth backend contract mismatch");
    }

    const roles = parsed.data.user.roles.filter((r): r is UserRole => (USER_ROLES as readonly string[]).includes(r));
    const mfa = parsed.data.staffMfa;
    const value: VerifiedSession = {
      actor: { kind: "user", id: parsed.data.user.id, roles: roles.length ? roles : ["user"] },
      staffMfaSatisfied: !mfa?.required || mfa.enforcementActive === false || mfa.sessionVerified,
    };

    this.remember(key, value);
    return value;
  }

  private remember(key: string, value: VerifiedSession): void {
    if (this.env.AUTH_SESSION_CACHE_TTL_MS === 0) return;
    if (this.cache.size >= SessionVerifier.MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.env.AUTH_SESSION_CACHE_TTL_MS });
  }
}
