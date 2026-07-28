import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { DATA_DIR } from "./paths";

/**
 * HMAC key for session cookies. Priority:
 *  1. AUTH_SECRET env (recommended — controls the key explicitly).
 *  2. A persistent, RANDOM per-instance secret stored in /data/.auth_secret
 *     (auto-generated on first run) so the app "just works" without env config
 *     yet sessions are NOT forgeable (unlike a hard-coded public default).
 *  3. Last-resort constant only if /data is unwritable (logged as insecure).
 * Changing the secret invalidates all existing sessions (users re-login once).
 */
let cachedSecret: string | null = null;
export function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET) return (cachedSecret = process.env.AUTH_SECRET);
  try {
    const f = path.join(DATA_DIR, ".auth_secret");
    if (fs.existsSync(f)) {
      const s = fs.readFileSync(f, "utf8").trim();
      if (s) return (cachedSecret = s);
    }
    const s = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(f, s, { encoding: "utf8", mode: 0o600 });
    console.warn(
      "[auth] AUTH_SECRET not set — generated a persistent random secret in /data/.auth_secret. Set AUTH_SECRET to control it."
    );
    return (cachedSecret = s);
  } catch {
    console.warn(
      "[auth] AUTH_SECRET not set and /data not writable — using an INSECURE fallback. Set AUTH_SECRET!"
    );
    return (cachedSecret = "openchatbox-insecure-fallback");
  }
}

export const SESSION_COOKIE = "nexus_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const PENDING_TTL = 1000 * 60 * 5; // 5 min for the 2FA step

const b64u = (b: Buffer | string) =>
  Buffer.from(b).toString("base64url");

export interface SessionPayload {
  uid: string;
  username: string;
  role: string;
  purpose?: "session" | "2fa" | "guest";
  exp: number;
}

/** Synthetic uid carried by a guest session (no stored user record). */
export const GUEST_UID = "guest";

function sign(payload: SessionPayload): string {
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verify(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64u(
    crypto.createHmac("sha256", getSecret()).update(body).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as SessionPayload;
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export const makeSession = (u: {
  id: string;
  username: string;
  role: string;
}) =>
  sign({
    uid: u.id,
    username: u.username,
    role: u.role,
    purpose: "session",
    exp: Date.now() + SESSION_TTL,
  });

/** A guest session cookie — no stored user, role "guest", 1-day lifetime. */
export const makeGuestSession = () =>
  sign({
    uid: GUEST_UID,
    username: "Gast",
    role: "guest",
    purpose: "guest",
    exp: Date.now() + 1000 * 60 * 60 * 24,
  });

export const makePendingTicket = (u: { id: string; username: string; role: string }) =>
  sign({
    uid: u.id,
    username: u.username,
    role: u.role,
    purpose: "2fa",
    exp: Date.now() + PENDING_TTL,
  });

/**
 * Whether to mark the session cookie `Secure`. A Secure cookie is dropped by
 * the browser over plain HTTP — which broke self-hosted deploys reached via
 * http://host:6769 (user created, but session cookie never sent back).
 * Derive it from the actual request protocol (honoring a reverse proxy's
 * X-Forwarded-Proto), with an explicit AUTH_COOKIE_SECURE override.
 */
function isSecureRequest(req?: NextRequest): boolean {
  const override = process.env.AUTH_COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;
  if (!req) return false;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

/** Session cookie options; pass the request so `Secure` matches http/https. */
export function sessionCookieOptions(req?: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL / 1000,
    secure: isSecureRequest(req),
  };
}
