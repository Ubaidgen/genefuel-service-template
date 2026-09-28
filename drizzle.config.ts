import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    // biome-ignore lint/style/noProcessEnv: drizzle-kit CLI config, outside the app's DI.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/service_template",
  },
});
