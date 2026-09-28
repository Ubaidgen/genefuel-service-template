import type { Request } from "express";

/** Must match `USER_ROLES` in genefuel-web-app `src/lib/db/schema.ts`. */
export const USER_ROLES = ["user", "clinician", "admin", "supplier", "technical", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES: readonly UserRole[] = USER_ROLES.filter((r) => r !== "user");

/** A member or staff user, verified against genefuel-web-app. */
export interface UserActor {
  kind: "user";
  id: string;
  roles: UserRole[];
}

/** Another GeneFuel service (web-app, cron worker…), verified by service token. */
export interface ServiceActor {
  kind: "service";
  /** The calling service name (`sub`). */
  id: string;
  scopes: string[];
}

export type Actor = UserActor | ServiceActor;

export type AuthedRequest = Request & { actor?: Actor; id?: unknown };

export function hasAnyRole(actor: Actor, roles: readonly UserRole[]): boolean {
  return actor.kind === "user" && actor.roles.some((r) => roles.includes(r));
}

export function isStaff(actor: Actor): boolean {
  return hasAnyRole(actor, STAFF_ROLES);
}

/** Stable identifier for audit rows: "user:<id>" or "service:<name>". */
export function actorRef(actor: Actor): string {
  return `${actor.kind}:${actor.id}`;
}
