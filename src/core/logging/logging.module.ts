import type { IncomingMessage, ServerResponse } from "node:http";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ENV, type Env } from "../../config/env.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "../http/request-id.js";
import { REDACT_PATHS } from "../security/log-redaction.js";

/** Path only — query strings can carry emails, tokens or search terms. */
function pathOf(url: string | undefined): string {
  return (url ?? "").split("?")[0] ?? "";
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
          base: { service: env.SERVICE_NAME },
          redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const id = resolveRequestId(req);
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          serializers: {
            req: (req: { id: unknown; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              path: pathOf(req.url),
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req: IncomingMessage) => pathOf(req.url).startsWith("/health") },
          transport:
            env.NODE_ENV === "development" ? { target: "pino-pretty", options: { singleLine: true } } : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
