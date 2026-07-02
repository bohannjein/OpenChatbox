import { NextRequest, NextResponse } from "next/server";
import { oidcConfig, decodeJwtPayload } from "@/lib/server/oidc";
import { upsertSsoUser } from "@/lib/server/users";
import {
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const cfg = oidcConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=sso`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("oidc_state")?.value;
  if (!code || !state || state !== cookieState)
    return NextResponse.redirect(`${origin}/login?error=sso_state`);

  const redirectUri = `${origin}/api/auth/oidc/callback`;
  let idToken: string | undefined;
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "openid profile email",
    });
    const r = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await r.json();
    idToken = data.id_token;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=sso_token`);
  }
  if (!idToken) return NextResponse.redirect(`${origin}/login?error=sso_token`);

  const claims = decodeJwtPayload(idToken);
  const username =
    (claims.preferred_username as string) ||
    (claims.email as string) ||
    (claims.upn as string) ||
    (claims.sub as string);
  if (!username)
    return NextResponse.redirect(`${origin}/login?error=sso_claims`);

  const user = upsertSsoUser(username, "entra");
  const res = NextResponse.redirect(origin + "/");
  res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions);
  res.cookies.set("oidc_state", "", { path: "/", maxAge: 0 });
  return res;
}
