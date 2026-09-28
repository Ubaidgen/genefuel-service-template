import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FieldDecryptError, isSealed, openWithKeyring, sealWithKey } from "../../src/core/security/field-crypto.js";

const k1 = randomBytes(32);
const k2 = randomBytes(32);
const ctx = { table: "examples", column: "note", rowId: "row-1" };

describe("field crypto", () => {
  it("round-trips and never stores plaintext", () => {
    const sealed = sealWithKey("blood glucose 5.4", "v1", k1, ctx);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("glucose");
    expect(openWithKeyring(sealed, new Map([["v1", k1]]), ctx)).toBe("blood glucose 5.4");
  });

  it("uses a fresh IV each time", () => {
    expect(sealWithKey("same", "v1", k1, ctx)).not.toBe(sealWithKey("same", "v1", k1, ctx));
  });

  it("fails when the value is moved to another row or column (AAD)", () => {
    const sealed = sealWithKey("x", "v1", k1, ctx);
    const keys = new Map([["v1", k1]]);
    expect(() => openWithKeyring(sealed, keys, { ...ctx, rowId: "row-2" })).toThrow(FieldDecryptError);
    expect(() => openWithKeyring(sealed, keys, { ...ctx, column: "title" })).toThrow(FieldDecryptError);
  });

  it("fails on tampering", () => {
    const sealed = sealWithKey("x", "v1", k1, ctx);
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("A") ? "B" : "A"}A`;
    expect(() => openWithKeyring(tampered, new Map([["v1", k1]]), ctx)).toThrow(FieldDecryptError);
  });

  it("opens old values after key rotation", () => {
    const old = sealWithKey("old", "v1", k1, ctx);
    const fresh = sealWithKey("new", "v2", k2, ctx);
    const ring = new Map([
      ["v1", k1],
      ["v2", k2],
    ]);
    expect(openWithKeyring(old, ring, ctx)).toBe("old");
    expect(openWithKeyring(fresh, ring, ctx)).toBe("new");
  });

  it("rejects unknown key ids and non-encrypted input", () => {
    const sealed = sealWithKey("x", "v9", k1, ctx);
    expect(() => openWithKeyring(sealed, new Map([["v1", k1]]), ctx)).toThrow(FieldDecryptError);
    expect(() => openWithKeyring("plain text", new Map([["v1", k1]]), ctx)).toThrow(FieldDecryptError);
  });
});
