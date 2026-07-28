import crypto from "crypto";

// RFC 4648 base32 (no padding)
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New random base32 TOTP secret. */
export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** RFC 6238 TOTP code for a given secret. */
export function totp(secret: string, at = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(at / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, "0");
}

/** Verify a token allowing ±window steps of clock drift. */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const t = token.trim();
  if (!/^\d{6}$/.test(t)) return false;
  for (let e = -window; e <= window; e++) {
    if (totp(secret, Date.now() + e * 30_000) === t) return true;
  }
  return false;
}

/** otpauth:// URI for authenticator apps. */
export function otpauthURI(secret: string, account: string, issuer = "OpenChatbox"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=SHA1&digits=6&period=30`;
}
