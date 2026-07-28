import { NextRequest, NextResponse } from "next/server";
import { findById, adminResetPassword } from "@/lib/server/users";
import { verify, passwordFingerprint } from "@/lib/server/session";
import { isPasswordResetEnabled } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Complete a password reset: verify the tokenized link and set a new password.
 * The token is single-use — it carries a fingerprint of the password it was
 * issued against, so once the password changes the same link no longer verifies.
 */
export async function POST(req: NextRequest) {
  if (!isPasswordResetEnabled())
    return NextResponse.json(
      { error: "Passwort-Reset ist deaktiviert." },
      { status: 403 }
    );

  const { token, password } = await req.json().catch(() => ({}));
  const pw = String(password ?? "");
  if (pw.length < 8)
    return NextResponse.json(
      { error: "Passwort muss mindestens 8 Zeichen lang sein." },
      { status: 400 }
    );

  const payload = verify(String(token ?? ""));
  if (!payload || payload.purpose !== "reset" || !payload.fp)
    return NextResponse.json(
      { error: "Link ungültig oder abgelaufen. Fordere einen neuen an." },
      { status: 400 }
    );

  const user = findById(payload.uid);
  if (!user || passwordFingerprint(user.passHash) !== payload.fp)
    return NextResponse.json(
      { error: "Link bereits verwendet oder abgelaufen. Fordere einen neuen an." },
      { status: 400 }
    );

  if (!adminResetPassword(user.id, pw))
    return NextResponse.json({ error: "Zurücksetzen fehlgeschlagen." }, { status: 400 });

  return NextResponse.json({ ok: true });
}
