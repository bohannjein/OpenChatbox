import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { getConfig, setConfig, type SmtpConfig } from "@/lib/server/config";
import { encryptSecret } from "@/lib/server/crypto";
import { verifySmtp } from "@/lib/server/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicView(s: SmtpConfig | undefined) {
  return {
    enabled: !!s?.enabled,
    host: s?.host ?? "",
    port: s?.port ?? 587,
    secure: !!s?.secure,
    user: s?.user ?? "",
    from: s?.from ?? "",
    hasPassword: !!(s?.passwordSecret && s.passwordSecret.length),
  };
}

/** Current SMTP settings WITHOUT the password (only whether one is stored). */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ smtp: publicView(getConfig().smtp) });
}

/**
 * Save SMTP settings, or `action:"test"` to verify the stored connection. The
 * password is encrypted at rest; an empty `password` keeps the stored one (so
 * the admin can toggle flags without re-entering it).
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "test") {
    const r = await verifySmtp();
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  const prev = getConfig().smtp ?? ({} as SmtpConfig);
  const next: SmtpConfig = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : !!prev.enabled,
    host: typeof body.host === "string" ? body.host.trim().slice(0, 255) : prev.host,
    port:
      typeof body.port === "number"
        ? Math.max(1, Math.min(65535, Math.floor(body.port)))
        : prev.port,
    secure: typeof body.secure === "boolean" ? body.secure : !!prev.secure,
    user: typeof body.user === "string" ? body.user.trim().slice(0, 255) : prev.user,
    from: typeof body.from === "string" ? body.from.trim().slice(0, 255) : prev.from,
    passwordSecret:
      typeof body.password === "string" && body.password.trim()
        ? encryptSecret(body.password.trim())
        : prev.passwordSecret,
  };

  setConfig({ smtp: next });
  return NextResponse.json({ smtp: publicView(next) });
}
