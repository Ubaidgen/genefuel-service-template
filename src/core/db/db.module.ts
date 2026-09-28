import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV, type Env } from "../../config/env.js";

export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Repositories accept either, so the same method works inside or outside a transaction. */
export type DbExecutor = Db | Tx;

export const DB = Symbol("DB");

export function createPool(env: Env): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    // A stuck query or forgotten transaction must not hold a connection forever.
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS * 2,
    connectionTimeoutMillis: 5_000,
    application_name: env.SERVICE_NAME,
  });
}

@Injectable()
export class DbPool implements OnApplicationShutdown {
  readonly pool: Pool;

  constructor(@Inject(ENV) env: Env) {
    this.pool = createPool(env);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

/** Runs work in one Postgres transaction; override in tests with a pass-through. */
@Injectable()
export class TransactionRunner {
  constructor(@Inject(DB) private readonly db: Db) {}

  run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}

@Global()
@Module({
  providers: [
    DbPool,
    { provide: DB, inject: [DbPool], useFactory: (p: DbPool): Db => drizzle(p.pool) },
    TransactionRunner,
  ],
  exports: [DB, DbPool, TransactionRunner],
})
export class DbModule {}
