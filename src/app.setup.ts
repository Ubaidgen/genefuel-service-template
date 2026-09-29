import { VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ENV, type Env } from "./config/env.js";

/**
 * HTTP hardening shared by main.ts and the e2e tests, so tests exercise the
 * exact production pipeline. Create the app with `{ bodyParser: false, bufferLogs: true }`.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.disable("x-powered-by");

  // JSON only, size-capped. No urlencoded/multipart parser unless a module needs one.
  app.useBodyParser("json", { limit: env.BODY_LIMIT });

  app.use(
    helmet({
      // Pure JSON API: nothing may be framed, scripted or embedded.
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    // Responses carry member data — never let a browser or proxy cache them.
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "authorization", "x-request-id"],
    exposedHeaders: ["x-request-id", "retry-after"],
    maxAge: 600,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableShutdownHooks();
  return app;
}
