import crypto from "crypto";
import { getSecret } from "./session";

/**
 * Symmetric secret-at-rest encryption for admin secrets (e.g. the BookStack API
 * token). Keyed off the per-instance AUTH secret (env or /data/.auth_secret), so
 * a leaked config.json alone does not reveal the token. AES-256-GCM (authenticated).
 *
 * Format: `enc:v1:<iv>:<tag>:<ciphertext>` (all base64). Anything not matching
 * that prefix is treated as legacy plaintext and returned as-is by decrypt().
 */
const PREFIX = "enc:v1:";

function key(): Buffer {
  // Derive a stable 32-byte key from the instance secret.
  return crypto.createHash("sha256").update(getSecret()).digest();
}

export function isEncrypted(s: string | undefined | null): boolean {
  return typeof s === "string" && s.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString(
    "base64"
  )}`;
}

export function decryptSecret(stored: string | undefined | null): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored; // legacy plaintext
  try {
    const [, , ivB64, tagB64, dataB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
