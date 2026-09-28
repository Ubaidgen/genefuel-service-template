/**
 * Architecture boundaries, enforced in CI (`npm run lint:boundaries`).
 * See docs/ARCHITECTURE.md for the reasoning behind each rule.
 * @type {import('dependency-cruiser').IConfiguration}
 */
const VENDOR_SDKS = "^node_modules/(stripe|resend|@vonage|@aws-sdk|openai|@anthropic-ai|axios|twilio)/";

module.exports = {
  forbidden: [
    {
      name: "module-public-api",
      comment: "Modules talk to each other only through the other module's index.ts.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/[^/]+/",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "root-uses-module-index",
      comment: "app.module.ts / schema.ts wire modules through their index.ts only.",
      severity: "error",
      from: { path: "^src/[^/]+\\.ts$" },
      to: { path: "^src/modules/[^/]+/", pathNot: "^src/modules/[^/]+/index\\.ts$" },
    },
    {
      name: "core-is-independent",
      comment: "core/ is shared infrastructure; it must never depend on a feature module.",
      severity: "error",
      from: { path: "^src/(core|config)/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "domain-is-pure",
      comment: "domain/ holds pure rules: only its own types/errors and core/errors. No DB, HTTP, crypto, clock, env.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/domain/" },
      to: {
        pathNot: ["^src/modules/$1/(domain/|types\\.ts$|errors\\.ts$)", "^src/core/errors/"],
      },
    },
    {
      name: "db-access-only-in-persistence",
      comment: "Only persistence/ may use drizzle-orm or pg directly.",
      severity: "error",
      from: { path: "^src/modules/", pathNot: "/persistence/" },
      to: { path: "^node_modules/(drizzle-orm|pg)/" },
    },
    {
      name: "controllers-are-thin",
      comment: "Controllers call use-cases; they never reach persistence, domain or the DB.",
      severity: "error",
      from: { path: "^src/modules/.*\\.controller\\.ts$" },
      to: { path: ["/persistence/", "/domain/", "^src/core/db/", "^node_modules/(drizzle-orm|pg)/"] },
    },
    {
      name: "vendor-sdks-in-integrations",
      comment: "Third-party SDKs live behind an adapter in integrations/ (timeouts, retries, PII rules in one place).",
      severity: "error",
      from: { path: "^src/", pathNot: "/integrations/" },
      to: { path: VENDOR_SDKS },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "src-not-to-test",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^test/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
