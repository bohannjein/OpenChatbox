import { NextRequest, NextResponse } from "next/server";
import { createUser, publicUser } from "@/lib/server/users";
import {
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password || String(password).length < 6)
    return NextResponse.json(
      { error: "Benutzername und Passwort (min. 6 Zeichen) erforderlich" },
      { status: 400 }
    );
  try {
    const user = createUser(String(username), String(password));
    const res = NextResponse.json({ ok: true, user: publicUser(user) });
    res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions(req));
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 400 }
    );
  }
}
