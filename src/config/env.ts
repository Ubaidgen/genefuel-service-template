import { existsSync } from "node:fs";
import { z } from "zod";

/**
 * The ONLY place that reads `process.env` (enforced by Biome `noProcessEnv`).
 * Everything else receives the parsed, typed `Env` through DI (`ENV` token).
 * Invalid or missing config fails the boot — never a half-configured service.
 */

const csv = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

/** "v1:<base64 32 bytes>,v2:<base64 32 bytes>" — see core/security/field-crypto.ts */
const fieldKeyring = z
  .string()
  .min(1)
  .transform((raw, ctx) => {
    const keys = new Map<string, Buffer>();
    for (const entry of raw.split(",")) {
      const [id, b64] = entry.trim().split(":");
      const key = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
      if (!id || !/^v\d+$/.test(id) || key.length !== 32) {
        ctx.addIssue({
          code: "custom",
          message: "FIELD_CRYPTO_KEYS entries must be 'v<N>:<base64 of 32 bytes>'",
        });
        return z.NEVER;
      }
      keys.set(id, key);
    }
    return keys;
  });

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    SERVICE_NAME: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/, "kebab-case service name"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    /** Number of trusted reverse-proxy hops (load balancer / Vercel / Cloudflare) for req.ip. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    CORS_ORIGINS: csv,
    BODY_LIMIT: z
      .string()
      .regex(/^\d+(kb|mb)$/)
      .default("100kb"),

    DATABASE_URL: z.url(),
    DATABASE_SSL: bool,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),

    /** Shared rate-limit store. Required in production so limits hold across instances. */
    REDIS_URL: z.url().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),

    /** genefuel-web-app origin; member/staff sessions are verified via `${AUTH_BASE_URL}/api/auth/me`. */
    AUTH_BASE_URL: z.url(),
    AUTH_SESSION_CACHE_TTL_MS: z.coerce.number().int().min(0).max(60_000).default(15_000),
    AUTH_TIMEOUT_MS: z.coerce.number().int().min(200).max(10_000).default(3_000),

    /** HS256 secret shared with callers that mint service tokens for this service. */
    SERVICE_TOKEN_SECRET: z.string().min(32, "SERVICE_TOKEN_SECRET must be at least 32 chars"),
    /** Services allowed to call this one (`iss` claim), e.g. "genefuel-web-app,genefuel-cron". */
    SERVICE_TOKEN_ISSUERS: csv,
    SERVICE_TOKEN_MAX_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),

    FIELD_CRYPTO_KEYS: fieldKeyring,
    FIELD_CRYPTO_ACTIVE_KEY_ID: z.string().regex(/^v\d+$/),
  })
  .superRefine((env, ctx) => {
    if (!env.FIELD_CRYPTO_KEYS.has(env.FIELD_CRYPTO_ACTIVE_KEY_ID)) {
      ctx.addIssue({
        code: "custom",
        path: ["FIELD_CRYPTO_ACTIVE_KEY_ID"],
        message: "active key id is not present in FIELD_CRYPTO_KEYS",
      });
    }
    if (env.NODE_ENV !== "production") return;

    const prod = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    prod(Boolean(env.REDIS_URL), "REDIS_URL", "required in production (shared rate limits)");
    prod(env.DATABASE_SSL, "DATABASE_SSL", "must be true in production");
    prod(env.AUTH_BASE_URL.startsWith("https://"), "AUTH_BASE_URL", "must be https in production");
    prod(env.SERVICE_TOKEN_ISSUERS.length > 0, "SERVICE_TOKEN_ISSUERS", "at least one issuer required");
    prod(
      env.CORS_ORIGINS.every((o) => o.startsWith("https://") && !o.includes("*")),
      "CORS_ORIGINS",
      "production origins must be explicit https origins (no wildcards)",
    );
    prod(!["debug", "trace"].includes(env.LOG_LEVEL), "LOG_LEVEL", "debug/trace logging is not allowed in production");
  });

export type Env = z.infer<typeof EnvSchema>;

/** DI token for the parsed env. */
export const ENV = Symbol("ENV");

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    // Paths + messages only; never echo values (they may be secrets).
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

/**
 * Local development reads ./.env (never overrides real env vars). Production and
 * tests get their config only from the environment / secret manager.
 */
export function loadEnv(): Env {
  const mode = process.env.NODE_ENV;
  if (mode !== "production" && mode !== "test" && existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  return parseEnv(process.env);
}
