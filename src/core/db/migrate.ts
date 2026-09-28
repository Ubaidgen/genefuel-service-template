/**
 * Applies SQL migrations from ./drizzle. Runs as a separate release step
 * (`npm run db:migrate`), never on app boot, so a bad migration cannot
 * crash-loop every instance.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../../config/env.js";
import { createPool } from "./db.module.js";

const pool = createPool(loadEnv());
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
} finally {
  await pool.end();
}
