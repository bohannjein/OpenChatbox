import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { publicUser, setUserProfile } from "@/lib/server/users";
import { checkEmailDomain } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service: a user changes their own login name and email address.
 *
 * Two rules that make this safe to expose:
 *  - The email domain must pass the same allow-list that gates self-registration
 *    (checkEmailDomain). An admin who restricts sign-up to @firma.de does not
 *    expect an existing account to move to a private address afterwards.
 *  - SSO accounts are read-only here. The directory is the source of truth and
 *    overwrites both fields on the next sign-in anyway; letting the user edit
 *    them would only produce a change that silently reverts. Names stay with the
 *    admin (or the IdP) — this endpoint deliberately does not touch them.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  if (user.provider !== "local")
    return NextResponse.json(
      {
        error:
          "Dieses Konto wird vom Firmenverzeichnis verwaltet. Benutzername und E-Mail ändern sich dort.",
      },
      { status: 403 }
    );

  const body = (await req.json().catch(() => ({}))) as {
    username?: unknown;
    email?: unknown;
  };

  const patch: { username?: string; email?: string } = {};
  if (typeof body.username === "string") patch.username = body.username;
  if (typeof body.email === "string") {
    const mail = body.email.trim();
    if (mail) {
      const domainError = checkEmailDomain(mail);
      if (domainError) return NextResponse.json({ error: domainError }, { status: 403 });
    }
    patch.email = mail;
  }
  // A username that looks like an address is one too — it is what the login form
  // and the reset flow accept, so the same domain rule applies.
  if (patch.username && patch.username.includes("@")) {
    const domainError = checkEmailDomain(patch.username);
    if (domainError) return NextResponse.json({ error: domainError }, { status: 403 });
  }

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nichts zu ändern." }, { status: 400 });

  const error = setUserProfile(user.id, patch);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // The session cookie carries the username; re-read so the client shows the new
  // value immediately (the cookie's copy is only used for display).
  const fresh = publicUser({ ...user, ...patch } as typeof user);
  return NextResponse.json({ ok: true, user: fresh });
}
