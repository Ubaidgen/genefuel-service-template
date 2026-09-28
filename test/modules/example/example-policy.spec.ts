import { describe, expect, it } from "vitest";
import {
  archiveExample,
  assertCanCreateExample,
  buildExample,
  MAX_ACTIVE_EXAMPLES_PER_OWNER,
} from "../../../src/modules/example/domain/example-policy.js";
import { ExampleAlreadyArchivedError, ExampleLimitReachedError } from "../../../src/modules/example/errors.js";

const now = new Date("2026-09-28T10:00:00Z");

describe("example policy", () => {
  it("allows creation below the active limit", () => {
    expect(() => assertCanCreateExample({ activeCount: MAX_ACTIVE_EXAMPLES_PER_OWNER - 1 })).not.toThrow();
  });

  it("blocks creation at the active limit", () => {
    expect(() => assertCanCreateExample({ activeCount: MAX_ACTIVE_EXAMPLES_PER_OWNER })).toThrow(
      ExampleLimitReachedError,
    );
  });

  it("builds an active example owned by the given owner", () => {
    const ex = buildExample({ id: "id-1", ownerId: "u1", input: { title: "t", note: null }, now });
    expect(ex).toMatchObject({ ownerId: "u1", status: "active", createdAt: now, archivedAt: null });
  });

  it("archives once, then refuses", () => {
    const ex = buildExample({ id: "id-1", ownerId: "u1", input: { title: "t", note: null }, now });
    const archived = archiveExample(ex, now);
    expect(archived).toMatchObject({ status: "archived", archivedAt: now });
    expect(ex.status).toBe("active");
    expect(() => archiveExample(archived, now)).toThrow(ExampleAlreadyArchivedError);
  });
});
