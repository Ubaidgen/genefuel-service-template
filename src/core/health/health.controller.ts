import { Controller, Get, Inject, ServiceUnavailableException, VERSION_NEUTRAL } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { sql } from "drizzle-orm";
import { Public } from "../auth/auth.decorators.js";
import { DB, type Db } from "../db/db.module.js";

/**
 * Public by design (load balancer / orchestrator probes). Returns status only —
 * never versions, hostnames, env or dependency error text.
 */
@Public()
@SkipThrottle()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
