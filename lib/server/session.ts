import crypto from "crypto";
import type { NextRequest } from "next/server";

// HMAC key for session cookies. SET AUTH_SECRET in production to a long random
// value — the fallback below is a well-known default: anyone who knows it can
// forge session cookies. It only exists so a fresh deployment boots.
const SECRET = process.env.AUTH_SECRET || "openchatbox";
if (!process.env.AUTH_SECRET)
  console.warn(
    "[auth] AUTH_SECRET not set — using the insecure default. Set AUTH_SECRET to a random value in production."
  );

export const SESSION_COOKIE = "nexus_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const PENDING_TTL = 1000 * 60 * 5; // 5 min for the 2FA step

const b64u = (b: Buffer | string) =>
  Buffer.from(b).toString("base64url");

export interface SessionPayload {
  uid: string;
  username: string;
  role: string;
  purpose?: "session" | "2fa";
  exp: number;
}

export function sign(payload: SessionPayload): string {
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function verify(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64u(
    crypto.createHmac("sha256", SECRET).update(body).digest()
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
