# Architecture

Each service is a NestJS app built from two kinds of code:

- **`src/core/`**: shared infrastructure (auth, errors, DB, audit, security, logging). It is identical across services and never contains feature logic.
- **`src/modules/<name>/`**: one folder per feature. Every module has the same internal layers.

## Module layers

```
src/modules/<name>/
├─ index.ts                 public API: the only file other code may import
├─ <name>.module.ts         Nest wiring
├─ <name>.controller.ts     member/staff HTTP routes (thin)
├─ internal-<name>.controller.ts   service-to-service routes (thin)
├─ types.ts                 Zod input schemas (.strict()) and output DTOs
├─ errors.ts                DomainError subclasses with member-safe messages
├─ access.ts                who may do what: ownership and role decisions
├─ domain/                  pure business rules, no I/O
├─ use-cases/               one file per action; orchestrates everything
├─ persistence/             Drizzle schema + repository (+ field encryption)
└─ integrations/            adapters for Stripe / Resend / AWS / LLMs (create when needed)
```

| Layer | Does | Must not |
|---|---|---|
| Controller | Validate input with `ZodPipe`, call **one** use-case, return its DTO | Touch the DB, persistence, domain rules |
| Use-case | Authorize → (transaction: lock → load → rule → write → audit) → side effects → DTO | Build SQL, call vendor SDKs directly |
| Domain | Decide: limits, eligibility, state transitions | Read DB/env/clock/network, generate IDs |
| Access | Answer "may this actor see/do this?" | Load data (the use-case passes it in) |
| Persistence | Queries, row ↔ domain mapping, encrypt/decrypt | Business rules |
| Integrations | Timeouts, retries, PII rules around a vendor SDK | Business rules |

## Request flow

```
request
  → helmet / CORS / JSON body limit / request id      (app.setup.ts)
  → ThrottlerGuard   rate limit per IP (Redis-backed in production)
  → AuthGuard        default deny: session, @Roles, @ServiceAuth or @Public
  → ZodPipe          strict input validation
  → controller → use-case → domain / access / persistence / audit
  → GlobalExceptionFilter   every error → { error: { code, message, requestId } }
```

`configureApp()` is shared by `main.ts` and the e2e tests, so the tests exercise the same HTTP pipeline that production runs.

## Boundary rules (enforced by `npm run lint:boundaries`)

| Rule | Why |
|---|---|
| `module-public-api`: modules import each other only via `index.ts` | A module can refactor its internals without breaking others |
| `root-uses-module-index`: `app.module.ts` / `schema.ts` use `index.ts` | Same reason |
| `core-is-independent`: `core/` never imports a module | Shared infra stays reusable across services |
| `domain-is-pure`: `domain/` imports only its own types/errors and `core/errors` | Rules are testable without mocks and cannot hide I/O |
| `db-access-only-in-persistence`: `drizzle-orm`/`pg` only in `persistence/` | One place to review queries, encryption and row scoping |
| `controllers-are-thin`: controllers never reach persistence/domain/DB | Every entry point (HTTP, cron, script) reuses the same use-case |
| `vendor-sdks-in-integrations`: Stripe/AWS/OpenAI/etc. only in `integrations/` | Timeouts, retries and PII filtering live in one adapter |
| `no-circular`, `src-not-to-test` | Hygiene |

`process.env` is readable only in `src/config/env.ts` (Biome `noProcessEnv`). Everything else receives the typed `Env` through DI.

## Decisions

| Decision | Reason |
|---|---|
| **Own Postgres per service** | Loose coupling; one service's migration cannot break another. User IDs are stored as plain text, with no cross-database foreign keys |
| **Sessions verified by genefuel-web-app** (`GET /api/auth/me`) | The web-app owns users, sessions and staff MFA. Services never hold the Better Auth secret or read session tables |
| **Service tokens: short-lived HS256 JWT** | Simple to mint from any caller; `iss`, `aud`, `sub`, scope and max TTL are all checked. Move to asymmetric keys (ES256/JWKS) if many services must verify but only a few may mint |
| **Migrations as a release step** | A bad migration fails the deploy instead of crash-looping every instance |
| **Audit in the same transaction as the change** | A change can never commit without its audit row |
| **404 for "exists but not yours"** | Callers cannot enumerate other members' IDs |
| **The example module is the scaffold** | It is compiled, linted and tested on every CI run, so the generator's output cannot drift |

## Testing layers

| Suite | Scope | Speed |
|---|---|---|
| `test/**/*.spec.ts` | Domain rules, use-cases with fakes, core primitives | Fast, no I/O |
| `test/**/*.e2e-spec.ts` | Full Nest app + `configureApp`, with auth backend / DB / audit faked | Fast |
| `test/**/*.int-spec.ts` | Real Postgres + Redis: migrations, encryption at rest, audit chain, trigger, concurrency | Needs Docker |

Every module needs a policy test, a use-case test and a security e2e suite. `new:module` generates all three.
