/**
 * Pure business rules. No DB, HTTP, env or clock access (enforced by
 * dependency-cruiser) — callers pass everything in, so rules test without mocks.
 */
import { ExampleAlreadyArchivedError, ExampleLimitReachedError } from "../errors.js";
import type { CreateExampleInput, Example } from "../types.js";

export const MAX_ACTIVE_EXAMPLES_PER_OWNER = 5;

export function assertCanCreateExample(args: { activeCount: number }): void {
  if (args.activeCount >= MAX_ACTIVE_EXAMPLES_PER_OWNER) {
    throw new ExampleLimitReachedError(MAX_ACTIVE_EXAMPLES_PER_OWNER);
  }
}

export function buildExample(args: { id: string; ownerId: string; input: CreateExampleInput; now: Date }): Example {
  return {
    id: args.id,
    ownerId: args.ownerId,
    title: args.input.title,
    note: args.input.note,
    status: "active",
    createdAt: args.now,
    archivedAt: null,
  };
}

export function archiveExample(example: Example, now: Date): Example {
  if (example.status === "archived") throw new ExampleAlreadyArchivedError();
  return { ...example, status: "archived", archivedAt: now };
}
