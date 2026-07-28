import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/server/session";
import { findById, updateUser } from "@/lib/server/users";
import { generateSecret, otpauthURI, verifyTotp } from "@/lib/server/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function me(req: NextRequest) {
  const p = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!p || p.purpose !== "session") return null;
  return findById(p.uid) ?? null;
}

/** Begin 2FA setup: create a pending secret, return it + otpauth URI. */
export async function GET(req: NextRequest) {
  const user = me(req);
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const secret = generateSecret();
  updateUser(user.id, {
    twoFactor: { ...user.twoFactor, pending: secret },
  });
  return NextResponse.json({
    secret,
    uri: otpauthURI(secret, user.username),
  });
}

/** Confirm setup (code) → enable, or disable. body: {action, code} */
export async function POST(req: NextRequest) {
  const user = me(req);
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { action, code } = await req.json().catch(() => ({}));

  if (action === "disable") {
    updateUser(user.id, { twoFactor: { enabled: false } });
    return NextResponse.json({ ok: true, enabled: false });
  }

  // enable
  const secret = user.twoFactor.pending;
  if (!secret)
    return NextResponse.json({ error: "Kein Setup gestartet" }, { status: 400 });
  if (!verifyTotp(secret, String(code || "")))
    return NextResponse.json({ error: "Code ungültig" }, { status: 400 });
  updateUser(user.id, { twoFactor: { enabled: true, secret } });
  return NextResponse.json({ ok: true, enabled: true });
}
