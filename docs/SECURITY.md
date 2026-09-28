# Security

These rules apply to every GeneFuel service. Most are enforced by code, tests or CI. The rest are on the PR checklist.

## Rules

### Authentication and authorization

| # | Rule | Enforced by |
|---|---|---|
| S1 | Every route is authenticated by default. `@Public()` is for health probes only | `AuthGuard` (global) |
| S2 | Role-restricted routes use `@Roles(...)` | `AuthGuard` |
| S3 | Staff sessions without completed MFA are rejected on every user route (`403 MFA_REQUIRED`) | `AuthGuard` + `SessionVerifier` |
| S4 | Service routes use `@ServiceAuth(scope)`. Member sessions are rejected there, and service tokens are rejected on member routes | `AuthGuard` |
| S5 | Service tokens: HS256 only, and `aud` = this service, `iss` in the allow-list, `sub` = `iss`, lifetime ≤ `SERVICE_TOKEN_MAX_TTL_SECONDS` | `ServiceTokenVerifier` |
| S6 | Ownership and role decisions live in the module's `access.ts`. A record the caller may not see answers **404** | Convention + e2e IDOR tests |
| S7 | If the auth backend is down, answer `503`, never "allow" | `AuthGuard` |

### Input

| # | Rule | Enforced by |
|---|---|---|
| S8 | All body/params/query go through `ZodPipe` with `.strict()` schemas and `max()` limits | Convention + e2e tests |
| S9 | `ownerId`, `role`, `status` and similar fields come from the session or server, never from the request body | `.strict()` + review |
| S10 | JSON only, capped at `BODY_LIMIT`. Oversized → 413, malformed → 400 | `configureApp` |

### Abuse

| # | Rule | Enforced by |
|---|---|---|
| S11 | Global rate limit per IP. Stricter `@Throttle` on writes and expensive routes | `ThrottlerGuard` |
| S12 | Production uses the Redis store so limits hold across instances | `env.ts` production rule |
| S13 | Limits that must hold under concurrency use an advisory lock or unique index (see `ExampleRepository.lockOwner`) | Integration test |

### Data protection

| # | Rule | Enforced by |
|---|---|---|
| S14 | Health data and member free text are encrypted with `FieldCrypto` (AES-256-GCM, AAD = table.column.rowId) | Convention + integration test |
| S15 | Staff reads of member data and all writes record an audit event, in the same transaction | Use-case pattern |
| S16 | `audit_events` is append-only (trigger) and hash-chained | Migration + integration test |
| S17 | Audit `metadata` holds IDs, counts and enums only. Never PII or health values | Review + use-case tests |
| S18 | Responses are DTOs, never raw rows, and carry `Cache-Control: no-store` | Convention + `configureApp` |

### Errors and logs

| # | Rule | Enforced by |
|---|---|---|
| S19 | Clients get `{ code, message, requestId }` only. No stacks, SQL or vendor errors | `GlobalExceptionFilter` + e2e test |
| S20 | `DomainError` messages are written to be shown to members | Review |
| S21 | Logs never contain cookies, tokens, emails, phones or notes; query strings are dropped | pino `redact` + serializers |
| S22 | Auth and scope denials are logged as security events with the request id | `AuthGuard` |

### Configuration and supply chain

| # | Rule | Enforced by |
|---|---|---|
| S23 | Config is Zod-validated at boot. Production refuses to start without Redis, with DB SSL off, with a non-https auth URL, with wildcard CORS, or with debug logging | `env.ts` + tests |
| S24 | Secrets never appear in code or logs; error messages about config name the key, never the value | Biome `noSecrets`, gitleaks, `env.ts` |
| S25 | Container runs as non-root; production dependencies are audited in CI; Dependabot weekly | Dockerfile, CI |

## Secrets

| Secret | Generate | Notes |
|---|---|---|
| `SERVICE_TOKEN_SECRET` | `openssl rand -base64 48` | Shared only with the services listed in `SERVICE_TOKEN_ISSUERS` |
| `FIELD_CRYPTO_KEYS` | `openssl rand -base64 32` per key | Format `v1:<key>,v2:<key>`. **Losing a key makes its data unreadable**. Back up in the secret manager |
| `DATABASE_URL` | Per environment | Least-privilege DB user; the app does not need `CREATE`/`DROP` outside migrations |

Keep production values in the platform's secret manager. Never commit a `.env` file.

### Rotating the field-encryption key

1. Add the new key: `FIELD_CRYPTO_KEYS=v1:<old>,v2:<new>`, and deploy.
2. Switch writes to it: `FIELD_CRYPTO_ACTIVE_KEY_ID=v2`, and deploy. New values use v2; old values still open with v1.
3. Optional: re-encrypt old rows with a one-off script, then remove `v1`.

### Rotating the service-token secret

HS256 has no key id, so rotation is a coordinated change:

1. Deploy the new secret to all callers and this service together, during a quiet window.
2. Tokens live ≤ 5 minutes, so there is no long tail.

If this becomes painful, move to asymmetric keys with a JWKS endpoint.

## New module checklist

- [ ] Routes use default auth, `@Roles` or `@ServiceAuth`. No new `@Public()`
- [ ] `access.ts` covers every read/write; non-visible records → 404
- [ ] `.strict()` schemas with `max()` on every string and array
- [ ] Sensitive columns encrypted via `FieldCrypto`
- [ ] Writes and staff reads audited, with no PII in metadata
- [ ] `@Throttle` on writes and expensive routes
- [ ] Security e2e suite covers 401 / 403 / 404 / 400 / 429 for every route
- [ ] Integration test covers encryption at rest and any concurrency-sensitive rule
- [ ] New env vars in `env.ts` (with production rules) and `.env.example`
- [ ] New tables considered for data retention and account deletion

## Reporting

Report a suspected vulnerability privately to the GeneFuel engineering lead. Do not open a public issue.
