import { Controller, HttpCode, Param, Post } from "@nestjs/common";
import { ServiceAuth } from "../../core/auth/auth.decorators.js";
import { Ctx, type RequestContext } from "../../core/http/request-context.js";
import { ZodPipe } from "../../core/http/validation.js";
import { ExampleIdParams } from "./types.js";
import { ArchiveExampleUseCase } from "./use-cases/archive-example.use-case.js";

/**
 * Service-to-service routes. Only callers holding a service token with the
 * named scope get in; member sessions are rejected here by the AuthGuard.
 */
@Controller({ path: "internal/examples", version: "1" })
export class InternalExampleController {
  constructor(private readonly archiveExample: ArchiveExampleUseCase) {}

  @Post(":id/archive")
  @HttpCode(200)
  @ServiceAuth("examples:archive")
  async archive(@Ctx() ctx: RequestContext, @Param(new ZodPipe(ExampleIdParams)) params: ExampleIdParams) {
    return { item: await this.archiveExample.execute(ctx, params.id) };
  }
}
