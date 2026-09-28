import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../helpers/test-app.js";

describe("HTTP hardening (configureApp)", () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  it("serves public health probes without auth", async () => {
    await t.http().get("/health/live").expect(200, { status: "ok" });
    await t.http().get("/health/ready").expect(200, { status: "ok" });
  });

  it("reports not-ready without leaking the dependency error", async () => {
    t.db.execute = async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    };
    const res = await t.http().get("/health/ready").expect(503);
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.5");
  });

  it("sets security headers and no-store on every response", async () => {
    const res = await t.http().get("/health/live");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["content-security-policy"]).toBe("default-src 'none';frame-ancestors 'none'");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("echoes a safe caller request id and replaces an unsafe one", async () => {
    const ok = await t.http().get("/health/live").set("x-request-id", "req-12345678");
    expect(ok.headers["x-request-id"]).toBe("req-12345678");

    const bad = await t.http().get("/health/live").set("x-request-id", "<script>alert(1)</script>");
    expect(bad.headers["x-request-id"]).not.toContain("<");
  });

  it("returns the standard error body for unknown routes", async () => {
    const res = await t.http().get("/v1/does-not-exist").expect(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Not found" });
  });

  it("allows CORS only for configured origins", async () => {
    const allowed = await t
      .http()
      .options("/v1/examples")
      .set("origin", "https://app.genefuel.test")
      .set("access-control-request-method", "GET");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.genefuel.test");

    const denied = await t
      .http()
      .options("/v1/examples")
      .set("origin", "https://evil.example")
      .set("access-control-request-method", "GET");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
