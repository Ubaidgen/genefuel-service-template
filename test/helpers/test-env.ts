export const TEST_SERVICE_NAME = "service-template";
export const TEST_SERVICE_TOKEN_SECRET = "test-only-service-token-secret-0123456789";
export const TEST_ISSUER = "genefuel-web-app";
export const TEST_FIELD_KEY_V1 = Buffer.alloc(32, 1).toString("base64");

export const testEnv: Record<string, string> = {
  NODE_ENV: "test",
  SERVICE_NAME: TEST_SERVICE_NAME,
  DATABASE_URL: "postgres://test:test@127.0.0.1:5432/service_template_test",
  AUTH_BASE_URL: "http://auth.test",
  AUTH_SESSION_CACHE_TTL_MS: "0",
  SERVICE_TOKEN_SECRET: TEST_SERVICE_TOKEN_SECRET,
  SERVICE_TOKEN_ISSUERS: TEST_ISSUER,
  FIELD_CRYPTO_KEYS: `v1:${TEST_FIELD_KEY_V1}`,
  FIELD_CRYPTO_ACTIVE_KEY_ID: "v1",
  RATE_LIMIT_MAX: "1000",
  BODY_LIMIT: "10kb",
  CORS_ORIGINS: "https://app.genefuel.test",
};

/** docker-compose.yml Postgres, used by *.int-spec.ts only. */
export const INTEGRATION_DATABASE_URL = "postgres://service:service@127.0.0.1:54329/service_template";
export const integrationEnv: Record<string, string> = { ...testEnv, DATABASE_URL: INTEGRATION_DATABASE_URL };
