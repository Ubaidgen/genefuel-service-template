import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mintServiceToken } from "../../../src/core/auth/service-token.js";
import { ExampleModule } from "../../../src/modules/example/index.js";
import { ExampleRepository } from "../../../src/modules/example/persistence/example.repository.js";
import { cookieFor } from "../../helpers/fakes.js";
import { createTestApp, type TestApp } from "../../helpers/test-app.js";
import { TEST_ISSUER, TEST_SERVICE_NAME, TEST_SERVICE_TOKEN_SECRET } from "../../helpers/test-env.js";
import { InMemoryExampleRepository } from "./example.fakes.js";

/**
 * Mandatory security suite for a module: authn, authz, IDOR, input, abuse,
 * safe errors. Copy the shape for every new module (npm run new:module does).
 */
describe("example module — security", () => {
  let t: TestApp;
  let repo: InMemoryExampleRepository;
  beforeEach(async () => {
    repo = new InMemoryExampleRepository();
    t = await createTestApp({ modules: [ExampleModule], overrides: [[ExampleRepository, repo]] });
  });
  afterEach(async () => {
    await t.close();
  });

  const token = (overrides: Partial<Parameters<typeof mintServiceToken>[0]> = {}) =>
    mintServiceToken({
      secret: TEST_SERVICE_TOKEN_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_SERVICE_NAME,
      scopes: ["examples:archive"],
      ...overrides,
    });

  describe("authentication", () => {
    it("rejects member routes without a session (401)", async () => {
      await t.http().get("/v1/examples").expect(401);
      await t.http().get("/v1/examples").set("cookie", cookieFor("nobody")).expect(401);
    });

    it("does not accept a service token on member routes", async () => {
      await t
        .http()
        .get("/v1/examples")
        .set("authorization", `Bearer ${await token()}`)
        .expect(401);
    });

    it("does not accept a member session on service routes", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      await t.http().post(`/v1/internal/examples/${ex.id}/archive`).set("cookie", cookieFor("alice")).expect(401);
    });

    it("answers 503 (not 401) when the auth backend is down", async () => {
      const res = await t.http().get("/v1/examples").set("cookie", cookieFor("down")).expect(503);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });

  describe("service tokens", () => {
    const archive = (id: string) => t.http().post(`/v1/internal/examples/${id}/archive`);

    it("accepts a valid token with the right scope and audits it", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      const res = await archive(ex.id)
        .set("authorization", `Bearer ${await token()}`)
        .expect(200);
      expect(res.body.item.status).toBe("archived");
      expect(t.audit.entries).toContainEqual(
        expect.objectContaining({ action: "example.archived", actor: `service:${TEST_ISSUER}` }),
      );
    });

    it.each([
      ["wrong audience", { audience: "some-other-service" }],
      ["unknown issuer", { issuer: "evil-service" }],
      ["wrong secret", { secret: "x".repeat(40) }],
      ["lifetime above the maximum", { ttlSeconds: 3600 }],
    ])("rejects a token with %s (401)", async (_label, overrides) => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      await archive(ex.id)
        .set("authorization", `Bearer ${await token(overrides)}`)
        .expect(401);
      expect(repo.rows.get(ex.id)?.status).toBe("active");
    });

    it("rejects a valid token missing the route's scope (403)", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      await archive(ex.id)
        .set("authorization", `Bearer ${await token({ scopes: ["examples:read"] })}`)
        .expect(403);
    });
  });

  describe("authorization / IDOR", () => {
    it("returns 404 — not 403 — for another member's example", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      const res = await t.http().get(`/v1/examples/${ex.id}`).set("cookie", cookieFor("bob")).expect(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("lists only the caller's own examples", async () => {
      repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      repo.seed({ id: randomUUID(), ownerId: "user-bob" });
      const res = await t.http().get("/v1/examples").set("cookie", cookieFor("bob")).expect(200);
      expect(res.body.items).toHaveLength(1);
    });

    it("lets permitted staff read a member's example and audits the read", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      await t.http().get(`/v1/examples/${ex.id}`).set("cookie", cookieFor("admin")).expect(200);
      expect(t.audit.entries).toContainEqual(
        expect.objectContaining({ action: "example.read_by_staff", resourceId: ex.id, actor: "user:user-admin" }),
      );
    });

    it("does not let staff outside the reader roles see it", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      await t.http().get(`/v1/examples/${ex.id}`).set("cookie", cookieFor("supplier")).expect(404);
    });

    it("blocks staff whose session has not completed MFA", async () => {
      const res = await t.http().get("/v1/examples").set("cookie", cookieFor("admin_no_mfa")).expect(403);
      expect(res.body.error.code).toBe("MFA_REQUIRED");
    });
  });

  describe("input validation", () => {
    const create = () => t.http().post("/v1/examples").set("cookie", cookieFor("alice"));

    it("creates with valid input and never trusts the body for ownership", async () => {
      const res = await create().send({ title: "  Hello  ", note: "private" }).expect(201);
      expect(res.body.item).toMatchObject({ title: "Hello", note: "private", status: "active" });
      expect(res.body.item.ownerId).toBeUndefined();
      expect([...repo.rows.values()][0]?.ownerId).toBe("user-alice");
    });

    it("rejects unknown fields (mass assignment) with issue paths only", async () => {
      const res = await create().send({ title: "x", ownerId: "user-bob", status: "archived" }).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(res.body)).not.toContain("user-bob");
      expect(repo.rows.size).toBe(0);
    });

    it.each([
      ["missing title", {}],
      ["empty title", { title: "   " }],
      ["over-long title", { title: "a".repeat(121) }],
      ["wrong type", { title: 42 }],
    ])("rejects %s (400)", async (_label, body) => {
      await create().send(body).expect(400);
    });

    it("rejects a non-UUID id param (400)", async () => {
      await t.http().get("/v1/examples/not-a-uuid").set("cookie", cookieFor("alice")).expect(400);
    });

    it("rejects bodies over BODY_LIMIT (413)", async () => {
      const res = await create()
        .set("content-type", "application/json")
        .send(JSON.stringify({ title: "x", note: "a".repeat(20_000) }))
        .expect(413);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("rejects malformed JSON with 400, not 500", async () => {
      const res = await create().set("content-type", "application/json").send('{"title": "x",').expect(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("business rules and abuse", () => {
    it("enforces the active-example limit with a safe 409", async () => {
      for (let i = 0; i < 5; i++) {
        await t
          .http()
          .post("/v1/examples")
          .set("cookie", cookieFor("alice"))
          .send({ title: `n${i}` })
          .expect(201);
      }
      const res = await t
        .http()
        .post("/v1/examples")
        .set("cookie", cookieFor("alice"))
        .send({ title: "one too many" })
        .expect(409);
      expect(res.body.error.code).toBe("EXAMPLE_LIMIT_REACHED");
    });

    it("rate-limits create beyond 10/minute (429)", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await t
          .http()
          .post("/v1/examples")
          .set("cookie", cookieFor("bob"))
          .send({ title: `r${i}` });
        statuses.push(r.status);
      }
      expect(statuses.at(-1)).toBe(429);
      expect(statuses.slice(0, 10)).not.toContain(429);
    });
  });

  describe("safe errors", () => {
    it("never leaks internal error text", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "user-alice" });
      repo.failNextRead = true;
      const res = await t.http().get(`/v1/examples/${ex.id}`).set("cookie", cookieFor("alice")).expect(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
      expect(typeof res.body.error.requestId).toBe("string");
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/SELECT|relation|stack|examples/i);
    });
  });
});
