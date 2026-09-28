import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { DomainError } from "../errors/domain-error.js";
import { type ErrorBody, INTERNAL_ERROR, SAFE_STATUS_MESSAGES } from "./error-response.js";
import { requestIdOf } from "./request-id.js";
import { RequestValidationError } from "./validation.js";

/**
 * Every error leaves the service through here. Clients only ever see a code,
 * a safe message and the request id; stacks, SQL and vendor errors stay in logs.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HTTP");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();
    const requestId = requestIdOf(req);

    const { status, body } = this.toResponse(exception, requestId);

    if (status >= 500) {
      this.logger.error({ err: exception, requestId }, "Unhandled error");
    } else if (exception instanceof DomainError) {
      this.logger.log({ code: exception.code, requestId }, "Domain rule rejected request");
    }

    res.status(status).json(body);
  }

  private toResponse(exception: unknown, requestId: string): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        body: { error: { code: exception.code, message: exception.message, requestId } },
      };
    }

    if (exception instanceof RequestValidationError) {
      return {
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            requestId,
            issues: exception.issues,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const safe = SAFE_STATUS_MESSAGES[status];
      if (safe) {
        // MFA_REQUIRED etc: guards may attach an explicit safe code.
        const response = exception.getResponse();
        const code =
          typeof response === "object" && response && "code" in response
            ? String((response as { code: unknown }).code)
            : safe.code;
        return { status, body: { error: { ...safe, code, requestId } } };
      }
    }

    // body-parser / http-errors (oversized or malformed JSON): client errors with `expose: true`.
    const clientStatus = exposedClientStatus(exception);
    const safe = clientStatus ? SAFE_STATUS_MESSAGES[clientStatus] : undefined;
    if (clientStatus && safe) {
      return { status: clientStatus, body: { error: { ...safe, requestId } } };
    }

    return { status: 500, body: { error: { ...INTERNAL_ERROR, requestId } } };
  }
}

function exposedClientStatus(exception: unknown): number | null {
  if (typeof exception !== "object" || exception === null) return null;
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === "number" && status >= 400 && status < 500 ? status : null;
}
