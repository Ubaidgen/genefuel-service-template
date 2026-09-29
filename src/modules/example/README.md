# example module

The reference module and the source for `npm run new:module`. See [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md).

| Route | Auth | Use-case |
|---|---|---|
| `POST /v1/examples` | member session, 10/min | `CreateExampleUseCase`: per-owner limit (advisory lock), encrypted note, audit |
| `GET /v1/examples` | member session | `ListExamplesUseCase`: caller's own records only |
| `GET /v1/examples/:id` | member session | `GetExampleUseCase`: owner, or audited staff read; others get 404 |
| `POST /v1/internal/examples/:id/archive` | service token, scope `examples:archive` | `ArchiveExampleUseCase`: row lock, state rule, audit |

Tests: `test/modules/example/` has policy, use-case and security e2e suites, plus a persistence integration test.
