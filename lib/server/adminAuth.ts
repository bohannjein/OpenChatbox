import { NextRequest } from "next/server";
import { verify, SESSION_COOKIE } from "./session";
import { findById, type User } from "./users";

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

/** The authenticated user for any logged-in request, or null. */
export function getUser(req: NextRequest): User | null {
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload || payload.purpose !== "session") return null;
  return findById(payload.uid) ?? null;
}
