import { Injectable } from "@nestjs/common";
import { AuditService } from "../../../core/audit/audit.service.js";
import { TransactionRunner } from "../../../core/db/db.module.js";
import { ResourceNotFoundError } from "../../../core/errors/domain-error.js";
import type { RequestContext } from "../../../core/http/request-context.js";
import { readAccess } from "../access.js";
import { EXAMPLE_LABEL } from "../errors.js";
import { ExampleRepository } from "../persistence/example.repository.js";
import { type ExampleDto, toExampleDto } from "../types.js";

@Injectable()
export class GetExampleUseCase {
  constructor(
    private readonly repo: ExampleRepository,
    private readonly tx: TransactionRunner,
    private readonly audit: AuditService,
  ) {}

  async execute(ctx: RequestContext, id: string): Promise<ExampleDto> {
    const example = await this.repo.findById(id);
    const access = example ? readAccess(ctx.actor, example) : "none";

    // Missing and forbidden look identical to the caller (no ID enumeration).
    if (!example || access === "none") throw new ResourceNotFoundError(EXAMPLE_LABEL.one);

    if (access === "staff") {
      await this.tx.run((tx) =>
        this.audit.record(tx, ctx, {
          action: "example.read_by_staff",
          resourceType: "example",
          resourceId: example.id,
        }),
      );
    }
    return toExampleDto(example);
  }
}
