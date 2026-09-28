import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";

/**
 * Field-level encryption for health data and member free text (AES-256-GCM).
 *
 * Stored format:  enc:<keyId>:<iv>.<tag>.<ciphertext>   (base64url parts)
 * AAD binds the value to table.column.rowId, so a ciphertext copied into
 * another row or column fails to decrypt instead of leaking.
 * Rotation: add a new key to FIELD_CRYPTO_KEYS, switch FIELD_CRYPTO_ACTIVE_KEY_ID;
 * old values still open with their original key id.
 */
export interface FieldContext {
  table: string;
  column: string;
  rowId: string;
}

export class FieldDecryptError extends Error {
  constructor(reason: string) {
    super(`field decrypt failed: ${reason}`);
    this.name = "FieldDecryptError";
  }
}

const PREFIX = "enc:";

function aad(ctx: FieldContext): Buffer {
  return Buffer.from(`${ctx.table}.${ctx.column}.${ctx.rowId}`, "utf8");
}

export function sealWithKey(plaintext: string, keyId: string, key: Buffer, ctx: FieldContext): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(ctx));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${keyId}:${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function openWithKeyring(stored: string, keys: ReadonlyMap<string, Buffer>, ctx: FieldContext): string {
  if (!stored.startsWith(PREFIX)) throw new FieldDecryptError("not an encrypted value");
  const [keyId, body] = stored.slice(PREFIX.length).split(":");
  const key = keyId ? keys.get(keyId) : undefined;
  if (!key || !body) throw new FieldDecryptError("unknown key id");

  const [iv, tag, ct] = body.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ct || iv.length !== 12 || tag.length !== 16) {
    throw new FieldDecryptError("malformed value");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad(ctx));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new FieldDecryptError("authentication failed");
  }
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

@Injectable()
export class FieldCrypto {
  constructor(@Inject(ENV) private readonly env: Env) {}

  seal(plaintext: string, ctx: FieldContext): string {
    const keyId = this.env.FIELD_CRYPTO_ACTIVE_KEY_ID;
    const key = this.env.FIELD_CRYPTO_KEYS.get(keyId);
    if (!key) throw new Error("active field-crypto key missing");
    return sealWithKey(plaintext, keyId, key, ctx);
  }

  open(stored: string, ctx: FieldContext): string {
    return openWithKeyring(stored, this.env.FIELD_CRYPTO_KEYS, ctx);
  }

  sealNullable(plaintext: string | null, ctx: FieldContext): string | null {
    return plaintext === null ? null : this.seal(plaintext, ctx);
  }

  openNullable(stored: string | null, ctx: FieldContext): string | null {
    return stored === null ? null : this.open(stored, ctx);
  }
}
