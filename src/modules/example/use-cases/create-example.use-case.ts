import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { AuditService } from "../../../core/audit/audit.service.js";
import { TransactionRunner } from "../../../core/db/db.module.js";
import type { RequestContext } from "../../../core/http/request-context.js";
import { requireUserActor } from "../access.js";
import { assertCanCreateExample, buildExample } from "../domain/example-policy.js";
import { ExampleRepository } from "../persistence/example.repository.js";
import { type CreateExampleInput, type ExampleDto, toExampleDto } from "../types.js";

/**
 * Order: authorize → (tx: lock → load → rule → write → audit) → side effects → DTO.
 */
@Injectable()
export class CreateExampleUseCase {
  constructor(
    private readonly repo: ExampleRepository,
    private readonly tx: TransactionRunner,
    private readonly audit: AuditService,
  ) {}

  async execute(ctx: RequestContext, input: CreateExampleInput): Promise<ExampleDto> {
    const owner = requireUserActor(ctx.actor);

    const example = await this.tx.run(async (tx) => {
      await this.repo.lockOwner(tx, owner.id);
      const activeCount = await this.repo.countActiveByOwner(owner.id, tx);
      assertCanCreateExample({ activeCount });

      const created = buildExample({ id: randomUUID(), ownerId: owner.id, input, now: new Date() });
      await this.repo.insert(tx, created);
      await this.audit.record(tx, ctx, {
        action: "example.created",
        resourceType: "example",
        resourceId: created.id,
        metadata: { hasNote: created.note !== null },
      });
      return created;
    });

    // Side effects (notifications, email, cache busting) go here — after commit.
    // Their failure is logged; it must never undo or fail the committed write.

    return toExampleDto(example);
  }
}
