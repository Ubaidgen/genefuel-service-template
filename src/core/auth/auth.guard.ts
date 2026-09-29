import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthedRequest, hasAnyRole, isStaff } from "./actor.js";
import { AUTH_POLICY, type AuthPolicy } from "./auth.decorators.js";
import { ServiceTokenVerifier } from "./service-token.js";
import { SessionVerifier } from "./session-verifier.js";

/**
 * Global guard — default deny. A route without a policy decorator is a
 * member/staff route; service tokens are never accepted there, and sessions
 * are never accepted on service routes.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger("Security");

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionVerifier,
    private readonly serviceTokens: ServiceTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<AuthPolicy | undefined>(AUTH_POLICY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { type: "user" };

    if (policy.type === "public") return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const requestId = typeof req.id === "string" ? req.id : undefined;

    if (policy.type === "service") {
      const token = bearerToken(req.headers.authorization);
      const actor = token ? await this.serviceTokens.verify(token) : null;
      if (!actor) {
        this.logger.warn({ event: "auth.service_token_rejected", requestId });
        throw new UnauthorizedException();
      }
      if (!actor.scopes.includes(policy.scope)) {
        this.logger.warn({ event: "auth.service_scope_denied", caller: actor.id, requestId });
        throw new ForbiddenException();
      }
      req.actor = actor;
      return true;
    }

    let session: Awaited<ReturnType<SessionVerifier["verify"]>>;
    try {
      session = await this.sessions.verify(req.headers.cookie);
    } catch (err) {
      this.logger.error({ event: "auth.backend_unavailable", err, requestId });
      throw new ServiceUnavailableException();
    }
    if (!session) throw new UnauthorizedException();

    const { actor } = session;
    if (policy.roles && !hasAnyRole(actor, policy.roles)) {
      this.logger.warn({ event: "auth.role_denied", userId: actor.id, requestId });
      throw new ForbiddenException();
    }
    // Staff privileges can apply on any user route (e.g. reading a member's record),
    // so an unverified staff session is stopped everywhere, not only on @Roles routes.
    if (isStaff(actor) && !session.staffMfaSatisfied) {
      this.logger.warn({ event: "auth.staff_mfa_required", userId: actor.id, requestId });
      throw new ForbiddenException({ code: "MFA_REQUIRED" });
    }

    req.actor = actor;
    return true;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 && token.length < 4096 ? token : null;
}
