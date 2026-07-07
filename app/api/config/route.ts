import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { verify, SESSION_COOKIE } from "@/lib/server/session";
import { publicConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Instance config (no secrets). Authenticated users and guests get the full
 * public config (providers, plugins, …). Anonymous callers (the login page,
 * before any cookie exists) get only the access policy + branding — not internal
 * provider/wiki URLs — enough to render the login page and decide guest entry.
 */
export async function GET(req: NextRequest) {
  const full = publicConfig();
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);
  const authed = !!getUser(req) || payload?.purpose === "guest";
  if (authed) return NextResponse.json(full);
  return NextResponse.json({
    appName: full.appName,
    logoUrl: full.logoUrl,
    accentColor: full.accentColor,
    selfRegistration: full.selfRegistration,
    guest: full.guest,
    sso: full.sso,
  });
}
