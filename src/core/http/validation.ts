import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

export class RequestValidationError extends BadRequestException {
  constructor(readonly issues: { path: string; code: string }[]) {
    super("VALIDATION_ERROR");
  }
}

/**
 * Validates body/params/query against a Zod schema. Use `.strict()` object
 * schemas so unknown keys are rejected (mass-assignment protection).
 *
 *   @Body(new ZodPipe(CreateExampleInput)) input: CreateExampleInput
 */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new RequestValidationError(
        result.error.issues.map((i) => ({
          path: i.path.join(".") || "(root)",
          code: i.code,
        })),
      );
    }
    return result.data;
  }
}
