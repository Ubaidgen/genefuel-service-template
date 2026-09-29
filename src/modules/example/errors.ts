import { DomainError } from "../../core/errors/domain-error.js";

/** Human-readable name used in member-facing messages. */
export const EXAMPLE_LABEL = { one: "example", many: "examples" } as const;

export class ExampleLimitReachedError extends DomainError {
  constructor(limit: number) {
    super("EXAMPLE_LIMIT_REACHED", `You can have at most ${limit} active ${EXAMPLE_LABEL.many}.`, 409);
  }
}

export class ExampleAlreadyArchivedError extends DomainError {
  constructor() {
    super("EXAMPLE_ALREADY_ARCHIVED", `This ${EXAMPLE_LABEL.one} is already archived.`, 409);
  }
}

export class MemberOnlyActionError extends DomainError {
  constructor() {
    super("MEMBER_ONLY", "This action is only available to signed-in members.", 403);
  }
}
