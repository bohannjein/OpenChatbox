import { NextRequest, NextResponse } from "next/server";
import { findByUsername, verifyPassword, publicUser } from "@/lib/server/users";
import {
  makeSession,
  makePendingTicket,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password)
    return NextResponse.json(
      { error: "Benutzername und Passwort erforderlich" },
      { status: 400 }
    );

  const user = findByUsername(username);
  if (!user || !verifyPassword(password, user))
    return NextResponse.json(
      { error: "Ungültige Anmeldedaten" },
      { status: 401 }
    );

  if (user.twoFactor.enabled) {
    return NextResponse.json({
      twoFactor: true,
      ticket: makePendingTicket(user),
    });
  }

  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions(req));
  return res;
}
