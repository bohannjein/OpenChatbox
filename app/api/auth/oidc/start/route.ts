import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { oidcConfig } from "@/lib/server/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = oidcConfig();
  const origin = req.nextUrl.origin;
  if (!cfg)
    return NextResponse.redirect(`${origin}/login?error=sso_not_configured`);

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/auth/oidc/callback`;
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
