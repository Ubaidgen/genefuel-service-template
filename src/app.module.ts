import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module.js";
import { AuditModule } from "./core/audit/audit.module.js";
import { AuthGuard } from "./core/auth/auth.guard.js";
import { AuthModule } from "./core/auth/auth.module.js";
import { DbModule } from "./core/db/db.module.js";
import { HealthController } from "./core/health/health.controller.js";
import { GlobalExceptionFilter } from "./core/http/exception.filter.js";
import { LoggingModule } from "./core/logging/logging.module.js";
import { RateLimitModule } from "./core/security/rate-limit.module.js";
import { SecurityModule } from "./core/security/security.module.js";
import { ExampleModule } from "./modules/example/index.js";
// new-module:import

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    DbModule,
    SecurityModule,
    AuditModule,
    AuthModule,
    RateLimitModule,
    ExampleModule,
    // new-module:module
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit first (also protects auth), then default-deny auth.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
