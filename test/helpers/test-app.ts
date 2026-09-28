import type { Type } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/app.setup.js";
import { AuditService } from "../../src/core/audit/audit.service.js";
import { SessionVerifier } from "../../src/core/auth/session-verifier.js";
import { DB, TransactionRunner } from "../../src/core/db/db.module.js";
import { FakeAuditService, FakeSessionVerifier, passThroughTransactions } from "./fakes.js";

// biome-ignore lint/suspicious/noExplicitAny: Nest provider tokens are (possibly abstract) classes.
type Class = abstract new (...args: any[]) => unknown;

/**
 * Boots the real AppModule + configureApp (guards, filter, helmet, CORS, body
 * limit, throttling) with only the edges faked: auth backend, Postgres, audit.
 * A module's e2e test passes its own module (so it runs even after the module
 * is unregistered from AppModule for production) and its in-memory repository.
 */
export async function createTestApp(opts: { modules?: Type[]; overrides?: [Class, unknown][] } = {}) {
  const audit = new FakeAuditService();
  const db = { execute: async () => [] as unknown[] };

  let builder = Test.createTestingModule({ imports: [AppModule, ...(opts.modules ?? [])] })
    .overrideProvider(SessionVerifier)
    .useValue(new FakeSessionVerifier())
    .overrideProvider(TransactionRunner)
    .useValue(passThroughTransactions)
    .overrideProvider(AuditService)
    .useValue(audit)
    .overrideProvider(DB)
    .useValue(db);
  for (const [token, value] of opts.overrides ?? []) {
    builder = builder.overrideProvider(token).useValue(value);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, bufferLogs: true });
  configureApp(app);
  await app.init();

  return {
    app,
    audit,
    db,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
