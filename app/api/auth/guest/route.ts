import { NextRequest, NextResponse } from "next/server";
import { getGuestConfig } from "@/lib/server/config";
import {
  makeGuestSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a guest session. Only works while the admin has guest access enabled;
 * issues a signed "guest" session cookie so the middleware lets the visitor into
 * the app. Guests are restricted server-side to the configured guest model and
 * are rejected by every getUser-protected route (no stored user record).
 */
export async function POST(req: NextRequest) {
  const guest = getGuestConfig();
  if (!guest.enabled || !guest.model)
    return NextResponse.json(
      { error: "Gast-Zugang ist nicht aktiviert." },
      { status: 403 }
    );
  const res = NextResponse.json({ ok: true, guest: true, model: guest.model });
  res.cookies.set(SESSION_COOKIE, makeGuestSession(), sessionCookieOptions(req));
  return res;
}
