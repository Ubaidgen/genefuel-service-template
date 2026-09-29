import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const exampleStatus = pgEnum("example_status", ["active", "archived"]);

export const examples = pgTable(
  "examples",
  {
    id: uuid("id").primaryKey(),
    /** genefuel-web-app user id. No FK: users live in the web-app database. */
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    /** Encrypted with FieldCrypto (AAD examples.note.<id>). */
    noteCiphertext: text("note_ciphertext"),
    status: exampleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("examples_owner_status_idx").on(t.ownerId, t.status)],
);
