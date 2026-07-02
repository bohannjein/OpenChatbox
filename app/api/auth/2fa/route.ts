import { NextRequest, NextResponse } from "next/server";
import { findById, publicUser } from "@/lib/server/users";
import {
  verify,
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";
import { verifyTotp } from "@/lib/server/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Second login step: verify the 6-digit TOTP for a pending ticket. */
export async function POST(req: NextRequest) {
  const { ticket, code } = await req.json().catch(() => ({}));
  const payload = verify(ticket);
  if (!payload || payload.purpose !== "2fa")
    return NextResponse.json(
      { error: "Sitzung abgelaufen, bitte erneut anmelden" },
      { status: 401 }
    );

  const user = findById(payload.uid);
  if (!user?.twoFactor.enabled || !user.twoFactor.secret)
    return NextResponse.json({ error: "2FA nicht aktiv" }, { status: 400 });

  if (!verifyTotp(user.twoFactor.secret, String(code || "")))
    return NextResponse.json({ error: "Code ungültig" }, { status: 401 });

  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions);
  return res;
}
