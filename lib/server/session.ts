import crypto from "crypto";

const SECRET =
  process.env.AUTH_SECRET || "dev-insecure-secret-change-me-in-.env";

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

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL / 1000,
  secure: process.env.NODE_ENV === "production",
};
