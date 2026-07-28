import { NextRequest, NextResponse } from "next/server";
import {
  findByUsername,
  verifyPassword,
  publicUser,
  isBuiltinAdmin,
} from "@/lib/server/users";
import { getAuthMethods } from "@/lib/server/config";
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

  if (user.blocked)
    return NextResponse.json(
      { error: "Konto ist gesperrt. Wende dich an den Administrator." },
      { status: 403 }
    );

  // Password sign-in may be disabled org-wide (e.g. SSO-only). The built-in
  // admin is always exempt — the guaranteed recovery account.
  if (!getAuthMethods().password.enabled && !isBuiltinAdmin(user))
    return NextResponse.json(
      { error: "Passwort-Anmeldung ist deaktiviert. Bitte über Firmen-Login anmelden." },
      { status: 403 }
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
