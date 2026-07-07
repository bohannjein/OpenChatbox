import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/server/session";
import { findById, publicUser } from "@/lib/server/users";
import { getGuestConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);

  // Guest session: no stored user, report guest state (only while still enabled).
  if (payload?.purpose === "guest") {
    const guest = getGuestConfig();
    return NextResponse.json({
      user: null,
      guest: guest.enabled && !!guest.model,
      guestModel: guest.enabled ? guest.model : null,
    });
  }

  if (!payload || payload.purpose !== "session")
    return NextResponse.json({ user: null, guest: false }, { status: 200 });
  const user = findById(payload.uid);
  if (!user) return NextResponse.json({ user: null, guest: false }, { status: 200 });
  return NextResponse.json({ user: publicUser(user), guest: false });
}
