import type { Tx } from "../../../src/core/db/db.module.js";
import type { Example } from "../../../src/modules/example/types.js";

/** Same public surface as ExampleRepository, backed by a Map. */
export class InMemoryExampleRepository {
  readonly rows = new Map<string, Example>();
  failNextRead = false;

  async lockOwner(): Promise<void> {}

  async countActiveByOwner(ownerId: string): Promise<number> {
    return [...this.rows.values()].filter((e) => e.ownerId === ownerId && e.status === "active").length;
  }

  async listByOwner(ownerId: string): Promise<Example[]> {
    return [...this.rows.values()].filter((e) => e.ownerId === ownerId);
  }

  async findById(id: string): Promise<Example | null> {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error('relation "examples" does not exist — SELECT * FROM examples');
    }
    return this.rows.get(id) ?? null;
  }

  async findByIdForUpdate(_tx: Tx, id: string): Promise<Example | null> {
    return this.findById(id);
  }

  async insert(_tx: Tx, example: Example): Promise<void> {
    this.rows.set(example.id, example);
  }

  async saveStatus(_tx: Tx, example: Example): Promise<void> {
    this.rows.set(example.id, example);
  }

  seed(example: Partial<Example> & Pick<Example, "id" | "ownerId">): Example {
    const row: Example = {
      title: "Seeded",
      note: null,
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      archivedAt: null,
      ...example,
    };
    this.rows.set(row.id, row);
    return row;
  }
}
