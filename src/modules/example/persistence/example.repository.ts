import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { DB, type Db, type DbExecutor, type Tx } from "../../../core/db/db.module.js";
import { FieldCrypto } from "../../../core/security/field-crypto.js";
import type { Example } from "../types.js";
import { examples } from "./example.schema.js";

const MAX_LIST = 100;

/**
 * The only code in this module that touches Postgres. Encrypts on write,
 * decrypts on read, and maps rows to the domain `Example` type.
 */
@Injectable()
export class ExampleRepository {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly crypto: FieldCrypto,
  ) {}

  /** Serialises writes per owner inside a transaction (race-safe limits). */
  async lockOwner(tx: Tx, ownerId: string): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`examples:${ownerId}`}))`);
  }

  async countActiveByOwner(ownerId: string, ex: DbExecutor = this.db): Promise<number> {
    const [row] = await ex
      .select({ n: count() })
      .from(examples)
      .where(and(eq(examples.ownerId, ownerId), eq(examples.status, "active")));
    return row?.n ?? 0;
  }

  async listByOwner(ownerId: string): Promise<Example[]> {
    const rows = await this.db
      .select()
      .from(examples)
      .where(eq(examples.ownerId, ownerId))
      .orderBy(desc(examples.createdAt))
      .limit(MAX_LIST);
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string, ex: DbExecutor = this.db): Promise<Example | null> {
    const [row] = await ex.select().from(examples).where(eq(examples.id, id)).limit(1);
    return row ? this.toDomain(row) : null;
  }

  async findByIdForUpdate(tx: Tx, id: string): Promise<Example | null> {
    const [row] = await tx.select().from(examples).where(eq(examples.id, id)).limit(1).for("update");
    return row ? this.toDomain(row) : null;
  }

  async insert(tx: Tx, example: Example): Promise<void> {
    await tx.insert(examples).values({
      id: example.id,
      ownerId: example.ownerId,
      title: example.title,
      noteCiphertext: this.crypto.sealNullable(example.note, noteContext(example.id)),
      status: example.status,
      createdAt: example.createdAt,
      archivedAt: example.archivedAt,
    });
  }

  async saveStatus(tx: Tx, example: Example): Promise<void> {
    await tx
      .update(examples)
      .set({ status: example.status, archivedAt: example.archivedAt })
      .where(eq(examples.id, example.id));
  }

  private toDomain(row: typeof examples.$inferSelect): Example {
    return {
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      note: this.crypto.openNullable(row.noteCiphertext, noteContext(row.id)),
      status: row.status,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    };
  }
}

function noteContext(rowId: string) {
  return { table: "examples", column: "note", rowId };
}
