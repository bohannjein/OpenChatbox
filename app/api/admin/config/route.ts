import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import {
  getConfig,
  setConfig,
  getBranding,
  brandingFields,
  resolveOidc,
  getSmtpConfig,
  type ServerConfig,
} from "@/lib/server/config";
import { LEGACY_BRAND_KEYS, resolveBranding, type BrandingConfig } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full instance config INCLUDING secrets (provider apiKeys) — admin only. */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // `ssoConfigured` tells the panel whether the OIDC env is present, so it can
  // show the SSO toggle as inert-until-configured instead of silently doing
  // nothing when enabled without env.
  return NextResponse.json({
    // `branding` is resolved (legacy flat fields folded in) so the panel always
    // gets a complete object, even on a config.json written before the brand layer.
    config: { ...getConfig(), branding: getBranding() },
    ssoConfigured: !!resolveOidc(),
    smtpConfigured: !!getSmtpConfig(),
  });
}

/** Patch the admin-global master config. Whitelisted keys only. */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<ServerConfig> = {};

  // Branding. Accepts the nested object (current clients) and/or the four flat
  // legacy keys (older clients still push those); nested wins. All of it goes
  // through sanitizeBranding, so an invalid hex or a `javascript:` URL is
  // dropped instead of being stored.
  const brandPatch: Partial<BrandingConfig> = {};
  for (const k of LEGACY_BRAND_KEYS)
    if (typeof body[k] === "string") brandPatch[k] = body[k] as string;
  if (body.branding && typeof body.branding === "object")
    Object.assign(brandPatch, body.branding as Partial<BrandingConfig>);
  if (Object.keys(brandPatch).length) Object.assign(patch, brandingFields(brandPatch));

  if (Array.isArray(body.providers)) patch.providers = body.providers as ServerConfig["providers"];
  if (body.routerModels && typeof body.routerModels === "object")
    patch.routerModels = body.routerModels as ServerConfig["routerModels"];
  if (body.search && typeof body.search === "object")
    patch.search = body.search as ServerConfig["search"];
  if (typeof body.embeddingModel === "string")
    patch.embeddingModel = body.embeddingModel.slice(0, 100);
  if (body.imageGen && typeof body.imageGen === "object")
    patch.imageGen = body.imageGen as ServerConfig["imageGen"];
  if (body.primaryProvider && typeof body.primaryProvider === "object")
    patch.primaryProvider = body.primaryProvider as ServerConfig["primaryProvider"];
  if (Array.isArray(body.properNouns))
    patch.properNouns = (body.properNouns as unknown[])
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 500);
  if (body.selfRegistration && typeof body.selfRegistration === "object") {
    const sr = body.selfRegistration as { enabled?: unknown; domains?: unknown };
    patch.selfRegistration = {
      enabled: !!sr.enabled,
      domains: Array.isArray(sr.domains)
        ? (sr.domains as unknown[])
            .filter((d): d is string => typeof d === "string")
            .map((d) => d.trim().toLowerCase().replace(/^@/, "").slice(0, 100))
            .filter(Boolean)
            .slice(0, 50)
        : [],
    };
  }
  if (body.guest && typeof body.guest === "object") {
    const g = body.guest as { enabled?: unknown; model?: unknown };
    patch.guest = {
      enabled: !!g.enabled,
      model: typeof g.model === "string" ? g.model.trim().slice(0, 200) || null : null,
    };
  }
  if (body.authMethods && typeof body.authMethods === "object") {
    const a = body.authMethods as {
      password?: { enabled?: unknown };
      sso?: { enabled?: unknown };
    };
    patch.authMethods = {
      password: { enabled: a.password?.enabled !== false },
      sso: { enabled: a.sso?.enabled !== false },
    };
  }
  if (body.passwordReset && typeof body.passwordReset === "object") {
    const pr = body.passwordReset as { enabled?: unknown };
    patch.passwordReset = { enabled: !!pr.enabled };
  }

  const next = setConfig(patch);
  return NextResponse.json({ config: { ...next, branding: resolveBranding(next) } });
}
