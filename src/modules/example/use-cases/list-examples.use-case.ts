import { Injectable } from "@nestjs/common";
import type { RequestContext } from "../../../core/http/request-context.js";
import { requireUserActor } from "../access.js";
import { ExampleRepository } from "../persistence/example.repository.js";
import { type ExampleDto, toExampleDto } from "../types.js";

@Injectable()
export class ListExamplesUseCase {
  constructor(private readonly repo: ExampleRepository) {}

  /** Always scoped to the caller — there is no "list someone else's" path. */
  async execute(ctx: RequestContext): Promise<ExampleDto[]> {
    const owner = requireUserActor(ctx.actor);
    const items = await this.repo.listByOwner(owner.id);
    return items.map(toExampleDto);
  }
}
