import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthMethods, resolveOidc, getPublicBaseUrl } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = resolveOidc();
  const origin = req.nextUrl.origin;
  // SSO must be both env-configured and enabled by the admin.
  if (!cfg || !getAuthMethods().sso.enabled)
    return NextResponse.redirect(`${origin}/login?error=sso_not_configured`);

  const state = crypto.randomBytes(16).toString("hex");
  // The redirect_uri must be the public (HTTPS) URL registered at the provider —
  // NOT the request origin, which can be http:// or an internal 0.0.0.0 bind.
  const redirectUri = `${getPublicBaseUrl(origin)}/api/auth/oidc/callback`;
  const url =
    `${cfg.authorizeUrl}?client_id=${encodeURIComponent(cfg.clientId)}` +
    `&response_type=code&response_mode=query` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("openid profile email")}` +
    `&state=${state}`;

  const res = NextResponse.redirect(url);
  res.cookies.set("oidc_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
