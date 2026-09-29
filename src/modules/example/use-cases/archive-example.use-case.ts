import { Injectable } from "@nestjs/common";
import { AuditService } from "../../../core/audit/audit.service.js";
import { TransactionRunner } from "../../../core/db/db.module.js";
import { ResourceNotFoundError } from "../../../core/errors/domain-error.js";
import type { RequestContext } from "../../../core/http/request-context.js";
import { archiveExample } from "../domain/example-policy.js";
import { EXAMPLE_LABEL } from "../errors.js";
import { ExampleRepository } from "../persistence/example.repository.js";
import { type ExampleDto, toExampleDto } from "../types.js";

/** Called by other services (service token, scope "examples:archive"). */
@Injectable()
export class ArchiveExampleUseCase {
  constructor(
    private readonly repo: ExampleRepository,
    private readonly tx: TransactionRunner,
    private readonly audit: AuditService,
  ) {}

  async execute(ctx: RequestContext, id: string): Promise<ExampleDto> {
    const archived = await this.tx.run(async (tx) => {
      const current = await this.repo.findByIdForUpdate(tx, id);
      if (!current) throw new ResourceNotFoundError(EXAMPLE_LABEL.one);

      const next = archiveExample(current, new Date());
      await this.repo.saveStatus(tx, next);
      await this.audit.record(tx, ctx, {
        action: "example.archived",
        resourceType: "example",
        resourceId: next.id,
      });
      return next;
    });
    return toExampleDto(archived);
  }
}
