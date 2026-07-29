import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { ACTIVE_WINDOW_MS, activeSessions, lastSeenByUid } from "@/lib/server/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is active right now. In-memory only (see lib/server/presence), so a restart
 * resets it. `lastSeen` also carries accounts whose session already went stale, so
 * the user list can show "last seen" as well as a live dot.
 */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    now: Date.now(),
    windowMs: ACTIVE_WINDOW_MS,
    sessions: activeSessions(),
    lastSeen: lastSeenByUid(),
  });
}
