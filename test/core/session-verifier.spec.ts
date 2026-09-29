import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../../src/config/env.js";
import { SessionVerifier } from "../../src/core/auth/session-verifier.js";
import { testEnv } from "../helpers/test-env.js";

function respond(status: number, body?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

const verifier = (overrides: Record<string, string> = {}) =>
  new SessionVerifier(parseEnv({ ...testEnv, ...overrides }));

describe("SessionVerifier (genefuel-web-app /api/auth/me)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null without calling the backend when there is no cookie", async () => {
    const spy = respond(200, {});
    await expect(verifier().verify(undefined)).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("forwards only the cookie to /api/auth/me and maps the actor", async () => {
    const spy = respond(200, { user: { id: "u1", roles: ["user"] }, staffMfa: null });
    await expect(verifier().verify("gf_session=abc")).resolves.toEqual({
      actor: { kind: "user", id: "u1", roles: ["user"] },
      staffMfaSatisfied: true,
    });
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://auth.test/api/auth/me");
    expect(init?.headers).toEqual({ cookie: "gf_session=abc", accept: "application/json" });
    expect(init?.redirect).toBe("error");
  });

  it("drops roles this service does not know", async () => {
    respond(200, { user: { id: "u1", roles: ["admin", "god_mode"] } });
    const s = await verifier().verify("c=1");
    expect(s?.actor.roles).toEqual(["admin"]);
  });

  it.each([
    [{ required: true, sessionVerified: false, enforcementActive: true }, false],
    [{ required: true, sessionVerified: true, enforcementActive: true }, true],
    [{ required: true, sessionVerified: false, enforcementActive: false }, true],
    [{ required: false, sessionVerified: false }, true],
  ])("computes staff MFA state %o → %s", async (staffMfa, expected) => {
    respond(200, { user: { id: "s1", roles: ["admin"] }, staffMfa });
    expect((await verifier().verify("c=1"))?.staffMfaSatisfied).toBe(expected);
  });

  it("treats 401 as signed out", async () => {
    respond(401, { error: "Unauthorized" });
    await expect(verifier().verify("c=1")).resolves.toBeNull();
  });

  it("throws on backend failure or contract change (guard answers 503)", async () => {
    respond(500);
    await expect(verifier().verify("c=1")).rejects.toThrow();
    vi.restoreAllMocks();
    respond(200, { unexpected: true });
    await expect(verifier().verify("c=1")).rejects.toThrow("contract");
  });

  it("caches verified sessions for the configured TTL", async () => {
    const spy = respond(200, { user: { id: "u1", roles: ["user"] } });
    const v = verifier({ AUTH_SESSION_CACHE_TTL_MS: "10000" });
    await v.verify("c=1");
    await v.verify("c=1");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
