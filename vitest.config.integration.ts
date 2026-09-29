import { defineConfig } from "vitest/config";
import { integrationEnv } from "./test/helpers/test-env.js";

/**
 * Real Postgres + Redis (`docker compose up -d`). Verifies what fakes cannot:
 * migrations apply, encryption at rest, audit chain + immutability trigger,
 * and race-safe invariants under concurrency.
 */
export default defineConfig({
  test: {
    root: "./",
    include: ["test/**/*.int-spec.ts"],
    globalSetup: ["./test/helpers/integration-setup.ts"],
    env: integrationEnv,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
