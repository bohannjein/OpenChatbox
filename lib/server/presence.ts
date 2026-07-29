import crypto from "crypto";
import type { User } from "./users";

/**
 * Who is currently using this instance.
 *
 * Sessions are stateless HMAC-signed cookies (lib/server/session.ts) — there is
 * no session table to query. But every authenticated route funnels through
 * getUser(), and the client re-hydrates every 20 s (lib/serverSync startLiveSync),
 * so recording each request is enough to know who is online.
 *
 * Kept in memory on purpose: no write to data/ on the hot path, and the IP and
 * user-agent recorded here never touch the disk. A restart empties the list, which
 * refills within one sync tick. On a multi-replica deployment each replica only
 * sees its own callers.
 */

export type PresenceKind = "user" | "guest" | "assistant";

export interface PresenceSession {
  /** uid|ip|ua-hash — one entry per account per device/browser. */
  key: string;
  uid: string;
  name: string;
  role: string;
  kind: PresenceKind;
  ip: string;
  ua: string;
  firstSeen: number;
  lastSeen: number;
  hits: number;
}

/** A session counts as active for this long after its last request. */
export const ACTIVE_WINDOW_MS = 120_000;

/** Bound the map: a flood of distinct callers must not grow it without limit. */
const MAX_SESSIONS = 5000;

const sessions = new Map<string, PresenceSession>();

const shortHash = (s: string) =>
  crypto.createHash("sha1").update(s).digest("base64url").slice(0, 8);

function ipOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "?";
}

/** Trim a user-agent to something readable in a table. */
function uaOf(req: Request): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 200);
}

function record(p: {
  uid: string;
  name: string;
  role: string;
  kind: PresenceKind;
  req: Request;
}): void {
  const ip = ipOf(p.req);
  const ua = uaOf(p.req);
  const key = `${p.uid}|${ip}|${shortHash(ua)}`;
  const now = Date.now();
  const prev = sessions.get(key);
  if (prev) {
    prev.lastSeen = now;
    prev.hits++;
    prev.name = p.name;
    prev.role = p.role;
    return;
  }
  if (sessions.size >= MAX_SESSIONS) evictStale(now);
  sessions.set(key, {
    key,
    uid: p.uid,
    name: p.name,
    role: p.role,
    kind: p.kind,
    ip,
    ua,
    firstSeen: now,
    lastSeen: now,
    hits: 1,
  });
}

function evictStale(now: number): void {
  for (const [k, v] of sessions)
    if (now - v.lastSeen > ACTIVE_WINDOW_MS) sessions.delete(k);
  if (sessions.size >= MAX_SESSIONS) {
    // Everything is active — drop the oldest rather than grow unbounded.
    const oldest = [...sessions.values()]
      .sort((a, b) => a.lastSeen - b.lastSeen)
      .slice(0, Math.ceil(MAX_SESSIONS / 10));
    for (const s of oldest) sessions.delete(s.key);
  }
}

/** Note a request from a signed-in user. Called from getUser — one choke point. */
export function touchUser(user: User, req: Request): void {
  record({ uid: user.id, name: user.username, role: user.role, kind: "user", req });
}

/** Note a guest request (guests have no stored user record). */
export function touchGuest(req: Request): void {
  record({ uid: "guest", name: "Gast", role: "guest", kind: "guest", req });
}

/** Note a call from an embedded assistant (not a person). */
export function touchAssistant(id: string, name: string, req: Request): void {
  record({ uid: `assistant:${id}`, name, role: "assistant", kind: "assistant", req });
}

/** Sessions seen within the window, newest activity first. */
export function activeSessions(windowMs = ACTIVE_WINDOW_MS): PresenceSession[] {
  const cutoff = Date.now() - windowMs;
  return [...sessions.values()]
    .filter((s) => s.lastSeen > cutoff)
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Last-seen timestamp per uid, including sessions that already went stale. */
export function lastSeenByUid(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions.values())
    if (!out[s.uid] || s.lastSeen > out[s.uid]) out[s.uid] = s.lastSeen;
  return out;
}

/** Test seam. */
export function resetPresence(): void {
  sessions.clear();
}
