/**
 * Base class for expected business-rule failures thrown by use-cases
 * (limit reached, not eligible yet, invalid state transition…).
 *
 * The global exception filter returns `code` + `message` to the client as-is,
 * so messages must be member-safe: no PII, no internal IDs, no stack detail.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status: 400 | 403 | 404 | 409 | 422;

  constructor(code: string, message: string, status: DomainError["status"] = 400) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

/**
 * Use for "does not exist" AND "exists but you may not see it" — returning 404
 * in both cases stops callers enumerating other members' resource IDs (IDOR).
 */
export class ResourceNotFoundError extends DomainError {
  constructor(resource: string) {
    super("NOT_FOUND", `The requested ${resource} was not found.`, 404);
  }
}
