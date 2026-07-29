import { NextRequest } from "next/server";
import { verify, SESSION_COOKIE } from "./session";
import { findById, type User } from "./users";
import { touchGuest, touchUser } from "./presence";

/**
 * Real server-side admin authorization for privileged API routes.
 * Verifies the signed session cookie AND re-reads the current stored role, so
 * a demotion takes effect immediately (the signed cookie's role could be stale).
 * Returns the admin user, or null if the request is not an authenticated admin.
 */
export function getAdmin(req: NextRequest): User | null {
  const user = getUser(req);
  return user && user.role === "admin" ? user : null;
}

/**
 * The authenticated user for any logged-in request, or null.
 *
 * Also the presence heartbeat: every authenticated route passes through here,
 * and the client re-hydrates every 20 s, so this is the one place that knows who
 * is currently active (see lib/server/presence).
 */
export function getUser(req: NextRequest): User | null {
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload || payload.purpose !== "session") return null;
  const user = findById(payload.uid) ?? null;
  if (user) touchUser(user, req);
  return user;
}

/**
 * Callers allowed on the chat path: a stored user, or a guest ticket. Returns
 * null when neither — the middleware only checks that some cookie exists, so
 * routes reachable by guests still have to verify the signature themselves.
 */
export function getUserOrGuest(
  req: NextRequest
): { user: User; isGuest: false } | { user: null; isGuest: true } | null {
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (payload?.purpose === "guest") {
    touchGuest(req);
    return { user: null, isGuest: true };
  }
  const user = getUser(req);
  return user ? { user, isGuest: false } : null;
}
