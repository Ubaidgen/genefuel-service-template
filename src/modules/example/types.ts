import { z } from "zod";

/** `.strict()` rejects unknown keys — callers cannot set ownerId, status, etc. */
export const CreateExampleInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().max(2000).nullable().default(null),
  })
  .strict();
export type CreateExampleInput = z.output<typeof CreateExampleInput>;

export const ExampleIdParams = z.object({ id: z.uuid() }).strict();
export type ExampleIdParams = z.output<typeof ExampleIdParams>;

export type ExampleStatus = "active" | "archived";

/** Domain record (decrypted). Never returned from a controller as-is. */
export interface Example {
  id: string;
  ownerId: string;
  title: string;
  note: string | null;
  status: ExampleStatus;
  createdAt: Date;
  archivedAt: Date | null;
}

/** API output: only the fields a client needs. */
export interface ExampleDto {
  id: string;
  title: string;
  note: string | null;
  status: ExampleStatus;
  createdAt: string;
}

export function toExampleDto(example: Example): ExampleDto {
  return {
    id: example.id,
    title: example.title,
    note: example.note,
    status: example.status,
    createdAt: example.createdAt.toISOString(),
  };
}
