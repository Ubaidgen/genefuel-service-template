import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";
import { testEnv } from "../helpers/test-env.js";

const production = {
  ...testEnv,
  NODE_ENV: "production",
  REDIS_URL: "redis://redis:6379",
  DATABASE_SSL: "true",
  AUTH_BASE_URL: "https://app.genefuel.co.uk",
  CORS_ORIGINS: "https://app.genefuel.co.uk",
};

describe("env validation", () => {
  it("parses a valid configuration", () => {
    const env = parseEnv(testEnv);
    expect(env.SERVICE_TOKEN_ISSUERS).toEqual(["genefuel-web-app"]);
    expect(env.FIELD_CRYPTO_KEYS.get("v1")).toHaveLength(32);
  });

  it("accepts a correct production configuration", () => {
    expect(() => parseEnv(production)).not.toThrow();
  });

  it.each([
    ["REDIS_URL", { REDIS_URL: undefined }],
    ["DATABASE_SSL", { DATABASE_SSL: "false" }],
    ["AUTH_BASE_URL", { AUTH_BASE_URL: "http://app.genefuel.co.uk" }],
    ["CORS_ORIGINS", { CORS_ORIGINS: "https://*.genefuel.co.uk" }],
    ["LOG_LEVEL", { LOG_LEVEL: "debug" }],
  ])("refuses to boot production with unsafe %s", (key, override) => {
    expect(() => parseEnv({ ...production, ...override })).toThrow(key);
  });

  it("rejects short secrets and bad keys without echoing their values", () => {
    const secret = "too-short-secret";
    let message = "";
    try {
      parseEnv({ ...testEnv, SERVICE_TOKEN_SECRET: secret, FIELD_CRYPTO_KEYS: "v1:AAAA" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("SERVICE_TOKEN_SECRET");
    expect(message).toContain("FIELD_CRYPTO_KEYS");
    expect(message).not.toContain(secret);
  });

  it("requires the active key to exist in the keyring", () => {
    expect(() => parseEnv({ ...testEnv, FIELD_CRYPTO_ACTIVE_KEY_ID: "v2" })).toThrow("FIELD_CRYPTO_ACTIVE_KEY_ID");
  });
});
