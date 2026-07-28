import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, profileFromClaims } from "@/lib/server/oidc";
import { upsertSsoUser } from "@/lib/server/users";
import { getAuthMethods, resolveOidc, getPublicBaseUrl } from "@/lib/server/config";
import {
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  // Public base for ALL browser redirects — req origin is the internal bind
  // (0.0.0.0:3000) behind a proxy and must never reach the browser.
  const base = getPublicBaseUrl(origin);
  const cfg = resolveOidc();
  // Reject if SSO is unconfigured or the admin turned the method off.
  if (!cfg || !getAuthMethods().sso.enabled)
    return NextResponse.redirect(`${base}/login?error=sso`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("oidc_state")?.value;
  if (!code || !state || state !== cookieState)
    return NextResponse.redirect(`${base}/login?error=sso_state`);

  // A stored client secret that decrypts to empty means AUTH_SECRET changed
  // since it was saved (e.g. a redeploy without a pinned key) — the token
  // exchange will fail as invalid_client. Surface it clearly.
  if (!cfg.clientSecret)
    console.error(
      "[oidc] client secret empty after decrypt — AUTH_SECRET changed? Pin AUTH_SECRET and re-save the SSO secret."
    );

  // Must byte-for-byte match the redirect_uri sent by /start (public HTTPS URL).
  const redirectUri = `${base}/api/auth/oidc/callback`;
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
    if (!idToken)
      // Log the provider's reason (no secrets) so the cause is diagnosable.
      console.error(
        `[oidc] token exchange failed: status=${r.status} error=${data.error} desc=${data.error_description}`
      );
  } catch (e) {
    console.error(
      "[oidc] token request threw (network/DNS to token endpoint?):",
      e instanceof Error ? e.message : e
    );
    return NextResponse.redirect(`${base}/login?error=sso_token`);
  }
  if (!idToken) return NextResponse.redirect(`${base}/login?error=sso_token`);

  const claims = decodeJwtPayload(idToken);

  // Optional tenant restriction: only accept users from the configured Entra
  // organization (the ID token's `tid` claim must match).
  if (cfg.tenantId && String(claims.tid ?? "") !== cfg.tenantId)
    return NextResponse.redirect(`${base}/login?error=sso_tenant`);

  const profile = profileFromClaims(claims);
  if (!profile.username)
    return NextResponse.redirect(`${base}/login?error=sso_claims`);

  // Sync name/email/role into the local user store and issue a session with the
  // (possibly IdP-mapped) role.
  const user = upsertSsoUser(profile, "entra");
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions(req));
  res.cookies.set("oidc_state", "", { path: "/", maxAge: 0 });
  return res;
}
