import { NextRequest, NextResponse } from "next/server";
import { createUser, publicUser } from "@/lib/server/users";
import { getSelfRegistration } from "@/lib/server/config";
import {
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Gate 1 — the admin must have self-registration enabled. When off, accounts
  // are created only by admins via the user management (this endpoint refuses).
  const { enabled, domains } = getSelfRegistration();
  if (!enabled)
    return NextResponse.json(
      { error: "Selbstregistrierung ist deaktiviert. Bitte wende dich an einen Administrator." },
      { status: 403 }
    );

  const { username, password } = await req.json().catch(() => ({}));
  const name = String(username ?? "").trim();
  if (!name || !password || String(password).length < 6)
    return NextResponse.json(
      { error: "Benutzername und Passwort (min. 6 Zeichen) erforderlich" },
      { status: 400 }
    );

  // Gate 2 — optional email-domain allow-list. The username is treated as the
  // email; its domain must be on the list.
  if (domains.length) {
    const at = name.lastIndexOf("@");
    const domain = at >= 0 ? name.slice(at + 1).toLowerCase() : "";
    if (!domain || !domains.includes(domain))
      return NextResponse.json(
        {
          error: `Registrierung nur mit einer erlaubten E-Mail-Domain möglich (${domains
            .map((d) => "@" + d)
            .join(", ")}).`,
        },
        { status: 403 }
      );
  }

  try {
    const user = createUser(name, String(password));
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
