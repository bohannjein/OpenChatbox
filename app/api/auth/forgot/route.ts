import { NextRequest, NextResponse } from "next/server";
import { findByUsernameOrEmail } from "@/lib/server/users";
import { makeResetTicket, passwordFingerprint } from "@/lib/server/session";
import { sendPasswordResetEmail } from "@/lib/server/mailer";
import { isPasswordResetEnabled, getPublicBaseUrl } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Request a password-reset link. Accepts a username OR email. To avoid account
 * enumeration this ALWAYS returns `{ ok: true }` — the email is only actually
 * sent when the account exists, is a local (password) account with an email, is
 * not blocked, and SMTP is configured. Wrong inputs look identical to the caller.
 */
export async function POST(req: NextRequest) {
  const { identifier } = await req.json().catch(() => ({}));
  const id = String(identifier ?? "").trim();
  const generic = NextResponse.json({ ok: true });
  // Feature off (admin toggle) or SMTP not configured → silently no-op.
  if (!id || !isPasswordResetEnabled()) return generic;

  const user = findByUsernameOrEmail(id);
  // Only local password accounts with a stored email can reset via email.
  if (!user || user.provider !== "local" || !user.passHash || !user.email || user.blocked)
    return generic;

  const fp = passwordFingerprint(user.passHash);
  const token = makeResetTicket(user, fp);
  // Use the configured public base URL (or env), falling back to the request
  // origin only when nothing is set — so links work behind a proxy / 0.0.0.0.
  const base = getPublicBaseUrl(req.nextUrl.origin);
  const link = `${base}/reset?token=${encodeURIComponent(token)}`;
  // Fire-and-forget; never reveal delivery success/failure to the caller.
  await sendPasswordResetEmail(user.email, link, user.firstName || user.displayName);
  return generic;
}
