import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Actor, AuthedRequest } from "../auth/actor.js";
import { requestIdOf } from "./request-id.js";

/** What every use-case receives: who is acting, and the id to correlate logs/audit. */
export interface RequestContext {
  actor: Actor;
  requestId: string;
}

/** `@Ctx() ctx: RequestContext` — only on authenticated routes. */
export const Ctx = createParamDecorator((_: unknown, ec: ExecutionContext): RequestContext => {
  const req = ec.switchToHttp().getRequest<AuthedRequest>();
  if (!req.actor) throw new Error("@Ctx() used on a route without an authenticated actor");
  return { actor: req.actor, requestId: requestIdOf(req) };
});
