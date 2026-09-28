import { defineConfig } from "vitest/config";
import { testEnv } from "./test/helpers/test-env.js";

/** Unit tests: pure domain rules, use-cases with fakes, core security primitives. */
export default defineConfig({
  test: {
    root: "./",
    include: ["test/**/*.spec.ts"],
    exclude: ["test/**/*.e2e-spec.ts", "node_modules/**"],
    env: testEnv,
  },
});
