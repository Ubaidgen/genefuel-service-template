# genefuel-service-template

Starting template for every new GeneFuel backend service: NestJS 12, TypeScript, Drizzle + Postgres, Redis.

Security, auth, audit logging, validation, rate limiting, field encryption, tests, Docker and CI are already in place. A new service starts from a working, tested baseline and adds only its own business logic.

- [Architecture](docs/ARCHITECTURE.md): layers, request flow, and the boundary rules CI enforces
- [Security](docs/SECURITY.md): the security rules every module follows, plus secrets and key rotation
- [Calling a service from genefuel-web-app](docs/WEB-APP-INTEGRATION.md)

## Start a new service

1. On GitHub: **Use this template → Create a new repository** (e.g. `genefuel-lab-service`).
   A maintainer must first tick **Settings → Template repository** on this repo (one-time).
2. Clone the new repo, then:

   ```bash
   npm install
   cp .env.example .env            # set SERVICE_NAME, generate the secrets (commands are in the file)
   npm run services:up             # Postgres + Redis in Docker
   npm run db:migrate:dev
   npm run start:dev               # http://localhost:3000/health/live
   ```

3. Add your first feature module:

   ```bash
   npm run new:module -- lab-order          # copies the example module under the new name
   npm run db:generate -- --name add_lab_orders
   ```

4. **Before the first production deploy, unregister the example module.** Remove `ExampleModule` from the `imports` in `src/app.module.ts`, so `/v1/examples` routes never ship. Keep the `src/modules/example` folder and its tests: `new:module` copies them, and CI keeps them compiling.

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with watch mode (reads `.env`) |
| `npm run verify` | Lint + types + boundaries + unit + e2e: run before every PR |
| `npm test` | Unit tests (domain rules, use-cases, security primitives) |
| `npm run test:e2e` | HTTP security suite: 401/403/404/400/413/429, headers, safe errors |
| `npm run test:integration` | Real Postgres + Redis (`npm run services:up` first) |
| `npm run lint:boundaries` | Architecture rules (dependency-cruiser) |
| `npm run new:module -- <name>` | Scaffold a feature module from the example |
| `npm run db:generate -- --name <x>` | Create a SQL migration from schema changes |
| `npm run db:migrate` | Apply migrations (release step, from `dist/`) |
| `npm run security:audit` | Audit production dependencies |

## Layout

```
src/
├─ main.ts, app.module.ts, app.setup.ts   bootstrap, wiring, HTTP hardening
├─ config/env.ts                          the only reader of process.env (Zod-validated)
├─ core/                                  shared infrastructure, never feature-specific
│  ├─ auth/        session + service-token auth, roles, staff MFA (default deny)
│  ├─ http/        error filter, Zod validation pipe, request id, request context
│  ├─ security/    field encryption, Redis rate-limit store, log redaction
│  ├─ db/          pool, transactions, migration runner
│  ├─ audit/       append-only, hash-chained audit log
│  ├─ health/      /health/live, /health/ready
│  └─ logging/     pino structured logs
└─ modules/<name>/                        one folder per feature (see docs/ARCHITECTURE.md)
test/                                     unit (*.spec), e2e (*.e2e-spec), integration (*.int-spec)
drizzle/                                  SQL migrations (generated + reviewed)
```

## Deploy

```bash
docker build -t my-service .
docker run --env-file prod.env my-service node dist/core/db/migrate.js   # release step
docker run --env-file prod.env -p 3000:3000 my-service
```

The image runs as a non-root user, uses `tini` so SIGTERM triggers a clean shutdown, and has a healthcheck on `/health/live`. In production the service refuses to start unless Redis is set, DB SSL is on, `AUTH_BASE_URL` is https, CORS origins are explicit, and log level is `info` or quieter.

## Requirements

Node 22+, Docker (for local Postgres/Redis and integration tests).
