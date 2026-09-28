import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Ctx, type RequestContext } from "../../core/http/request-context.js";
import { ZodPipe } from "../../core/http/validation.js";
import { CreateExampleInput, ExampleIdParams } from "./types.js";
import { CreateExampleUseCase } from "./use-cases/create-example.use-case.js";
import { GetExampleUseCase } from "./use-cases/get-example.use-case.js";
import { ListExamplesUseCase } from "./use-cases/list-examples.use-case.js";

/**
 * Member/staff routes (session auth is the default — no decorator needed).
 * Thin by rule: validate → call one use-case → return its DTO.
 */
@Controller({ path: "examples", version: "1" })
export class ExampleController {
  constructor(
    private readonly createExample: CreateExampleUseCase,
    private readonly listExamples: ListExamplesUseCase,
    private readonly getExample: GetExampleUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Ctx() ctx: RequestContext, @Body(new ZodPipe(CreateExampleInput)) input: CreateExampleInput) {
    return { item: await this.createExample.execute(ctx, input) };
  }

  @Get()
  async list(@Ctx() ctx: RequestContext) {
    return { items: await this.listExamples.execute(ctx) };
  }

  @Get(":id")
  async get(@Ctx() ctx: RequestContext, @Param(new ZodPipe(ExampleIdParams)) params: ExampleIdParams) {
    return { item: await this.getExample.execute(ctx, params.id) };
  }
}
