import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditService } from "../../../src/core/audit/audit.service.js";
import type { TransactionRunner } from "../../../src/core/db/db.module.js";
import { ResourceNotFoundError } from "../../../src/core/errors/domain-error.js";
import type { RequestContext } from "../../../src/core/http/request-context.js";
import { MemberOnlyActionError } from "../../../src/modules/example/errors.js";
import type { ExampleRepository } from "../../../src/modules/example/persistence/example.repository.js";
import { CreateExampleUseCase } from "../../../src/modules/example/use-cases/create-example.use-case.js";
import { GetExampleUseCase } from "../../../src/modules/example/use-cases/get-example.use-case.js";
import { FakeAuditService, passThroughTransactions } from "../../helpers/fakes.js";
import { InMemoryExampleRepository } from "./example.fakes.js";

const member = (id: string): RequestContext => ({
  actor: { kind: "user", id, roles: ["user"] },
  requestId: "req-test-0001",
});

describe("example use-cases", () => {
  let repo: InMemoryExampleRepository;
  let audit: FakeAuditService;
  const deps = () =>
    [
      repo as unknown as ExampleRepository,
      passThroughTransactions as unknown as TransactionRunner,
      audit as unknown as AuditService,
    ] as const;

  beforeEach(() => {
    repo = new InMemoryExampleRepository();
    audit = new FakeAuditService();
  });

  describe("CreateExampleUseCase", () => {
    it("persists for the acting member and writes an audit entry without PII", async () => {
      const dto = await new CreateExampleUseCase(...deps()).execute(member("u1"), {
        title: "t",
        note: "secret health detail",
      });
      expect(repo.rows.get(dto.id)?.ownerId).toBe("u1");
      expect(audit.entries).toEqual([
        expect.objectContaining({ action: "example.created", resourceId: dto.id, metadata: { hasNote: true } }),
      ]);
      expect(JSON.stringify(audit.entries)).not.toContain("secret health detail");
    });

    it("refuses service actors", async () => {
      const ctx: RequestContext = { actor: { kind: "service", id: "svc", scopes: [] }, requestId: "r" };
      await expect(new CreateExampleUseCase(...deps()).execute(ctx, { title: "t", note: null })).rejects.toThrow(
        MemberOnlyActionError,
      );
    });
  });

  describe("GetExampleUseCase", () => {
    it("returns the owner's example without auditing", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "u1" });
      await expect(new GetExampleUseCase(...deps()).execute(member("u1"), ex.id)).resolves.toMatchObject({
        id: ex.id,
      });
      expect(audit.entries).toHaveLength(0);
    });

    it("hides other members' examples as not found", async () => {
      const ex = repo.seed({ id: randomUUID(), ownerId: "u1" });
      await expect(new GetExampleUseCase(...deps()).execute(member("u2"), ex.id)).rejects.toThrow(
        ResourceNotFoundError,
      );
    });
  });
});
