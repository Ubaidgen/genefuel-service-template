/**
 * Who may do what with an Example. Pure functions — the use-case loads the
 * record, then asks here. Keep every ownership/role decision in this file.
 */
import { type Actor, hasAnyRole, type UserActor, type UserRole } from "../../core/auth/actor.js";
import { MemberOnlyActionError } from "./errors.js";
import type { Example } from "./types.js";

/** Staff roles allowed to read any member's examples (each read is audited). */
export const EXAMPLE_STAFF_READERS: readonly UserRole[] = ["admin", "super_admin", "clinician"];

export type ReadAccess = "owner" | "staff" | "none";

export function readAccess(actor: Actor, example: Example): ReadAccess {
  if (actor.kind === "user" && actor.id === example.ownerId) return "owner";
  if (hasAnyRole(actor, EXAMPLE_STAFF_READERS)) return "staff";
  return "none";
}

/** Creating/listing "my" examples only makes sense for a signed-in user. */
export function requireUserActor(actor: Actor): UserActor {
  if (actor.kind !== "user") throw new MemberOnlyActionError();
  return actor;
}
