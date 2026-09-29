import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "./actor.js";

/**
 * Route access policy. Every route is authenticated by default:
 *
 *   (no decorator)          any signed-in member or staff user (session)
 *   @Roles("admin", …)      signed-in user with one of these roles (+ staff MFA)
 *   @ServiceAuth("scope")   another service with a token carrying this scope
 *   @Public()               no auth — health checks only; needs a review comment
 */
export const AUTH_POLICY = "auth:policy";

export type AuthPolicy = { type: "public" } | { type: "user"; roles?: UserRole[] } | { type: "service"; scope: string };

export const Public = () => SetMetadata(AUTH_POLICY, { type: "public" } satisfies AuthPolicy);

export const Roles = (...roles: [UserRole, ...UserRole[]]) =>
  SetMetadata(AUTH_POLICY, { type: "user", roles } satisfies AuthPolicy);

export const ServiceAuth = (scope: string) => SetMetadata(AUTH_POLICY, { type: "service", scope } satisfies AuthPolicy);
