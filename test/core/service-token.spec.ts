import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";
import { mintServiceToken, ServiceTokenVerifier } from "../../src/core/auth/service-token.js";
import { TEST_ISSUER, TEST_SERVICE_NAME, TEST_SERVICE_TOKEN_SECRET, testEnv } from "../helpers/test-env.js";

const verifier = new ServiceTokenVerifier(parseEnv(testEnv));
const secret = new TextEncoder().encode(TEST_SERVICE_TOKEN_SECRET);

describe("ServiceTokenVerifier", () => {
  it("accepts a well-formed token and exposes its scopes", async () => {
    const token = await mintServiceToken({
      secret: TEST_SERVICE_TOKEN_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_SERVICE_NAME,
      scopes: ["a:read", "a:write"],
    });
    await expect(verifier.verify(token)).resolves.toEqual({
      kind: "service",
      id: TEST_ISSUER,
      scopes: ["a:read", "a:write"],
    });
  });

  it("rejects alg=none", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({ iss: TEST_ISSUER, sub: TEST_ISSUER, aud: TEST_SERVICE_NAME, iat: now, exp: now + 60 }),
    ).toString("base64url");
    await expect(verifier.verify(`${header}.${body}.`)).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(TEST_ISSUER)
      .setSubject(TEST_ISSUER)
      .setAudience(TEST_SERVICE_NAME)
      .setIssuedAt(now - 600)
      .setExpirationTime(now - 120)
      .sign(secret);
    await expect(verifier.verify(token)).resolves.toBeNull();
  });

  it("rejects a subject that differs from the issuer (impersonation)", async () => {
    const token = await new SignJWT({ scope: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(TEST_ISSUER)
      .setSubject("some-other-service")
      .setAudience(TEST_SERVICE_NAME)
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(secret);
    await expect(verifier.verify(token)).resolves.toBeNull();
  });

  it("rejects garbage", async () => {
    await expect(verifier.verify("not.a.jwt")).resolves.toBeNull();
  });
});
