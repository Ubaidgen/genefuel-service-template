import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { parseEnv } from "../../src/config/env.js";
import { createPool } from "../../src/core/db/db.module.js";
import { integrationEnv } from "./test-env.js";

/** Vitest globalSetup for *.int-spec.ts: fresh schema + all migrations, once per run. */
export default async function setup() {
  // globalSetup runs outside the test workers, so test.env is not applied here.
  const pool = createPool(parseEnv(integrationEnv));
  const db = drizzle(pool);
  try {
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
