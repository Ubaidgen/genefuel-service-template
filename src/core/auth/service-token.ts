import { Inject, Injectable } from "@nestjs/common";
import { errors, jwtVerify, SignJWT } from "jose";
import { ENV, type Env } from "../../config/env.js";
import type { ServiceActor } from "./actor.js";

const ALG = "HS256";

/**
 * Service-to-service auth. The caller mints a short-lived JWT:
 *   iss = calling service (must be in SERVICE_TOKEN_ISSUERS)
 *   aud = this service's SERVICE_NAME
 *   sub = calling service, scope = space-separated scopes, exp ≤ max TTL
 */
@Injectable()
export class ServiceTokenVerifier {
  private readonly secret: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.secret = new TextEncoder().encode(env.SERVICE_TOKEN_SECRET);
  }

  /** Returns null for any invalid token — callers answer 401 without detail. */
  async verify(token: string): Promise<ServiceActor | null> {
    if (this.env.SERVICE_TOKEN_ISSUERS.length === 0) return null;
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALG],
        audience: this.env.SERVICE_NAME,
        issuer: this.env.SERVICE_TOKEN_ISSUERS,
        requiredClaims: ["exp", "iat", "sub"],
        clockTolerance: 30,
      });
      const iat = payload.iat ?? 0;
      const exp = payload.exp ?? 0;
      if (exp - iat > this.env.SERVICE_TOKEN_MAX_TTL_SECONDS) return null;
      if (!payload.sub || payload.sub !== payload.iss) return null;

      const scope = typeof payload.scope === "string" ? payload.scope : "";
      return { kind: "service", id: payload.sub, scopes: scope.split(" ").filter(Boolean) };
    } catch (err) {
      if (err instanceof errors.JOSEError) return null;
      throw err;
    }
  }
}

/** For callers (and tests). Other services copy this helper to call this one. */
export async function mintServiceToken(args: {
  secret: string;
  issuer: string;
  audience: string;
  scopes: string[];
  ttlSeconds?: number;
}): Promise<string> {
  return new SignJWT({ scope: args.scopes.join(" ") })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setIssuer(args.issuer)
    .setSubject(args.issuer)
    .setAudience(args.audience)
    .setIssuedAt()
    .setExpirationTime(`${args.ttlSeconds ?? 60}s`)
    .sign(new TextEncoder().encode(args.secret));
}
