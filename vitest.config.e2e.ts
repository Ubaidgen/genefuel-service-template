import { defineConfig } from "vitest/config";
import { testEnv } from "./test/helpers/test-env.js";

/**
 * HTTP-level tests: boot the real Nest app (same `configureApp` as production)
 * with persistence and the auth backend faked. Security behaviour — 401/403/404
 * (IDOR)/400/429, headers, safe errors — is asserted here.
 */
export default defineConfig({
  test: {
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    env: testEnv,
    testTimeout: 20_000,
  },
});
