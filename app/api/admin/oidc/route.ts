import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import {
  getConfig,
  setConfig,
  oidcSource,
  DEFAULT_SSO_LABEL,
  type OidcStoredConfig,
} from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicView(o: OidcStoredConfig | undefined) {
  return {
    enabled: !!o?.enabled,
    provider: o?.provider ?? "entra",
    clientId: o?.clientId ?? "",
    tenantId: o?.tenantId ?? "",
    authorizeUrl: o?.authorizeUrl ?? "",
    tokenUrl: o?.tokenUrl ?? "",
    buttonLabel: o?.buttonLabel?.trim() || DEFAULT_SSO_LABEL,
    hasSecret: !!(o?.clientSecretEnc && o.clientSecretEnc.length),
  };
}

/** Current SSO settings WITHOUT the client secret, plus the active source. */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // `source` tells the panel whether SSO currently resolves from the UI config,
  // from environment variables, or is unconfigured.
  return NextResponse.json({ oidc: publicView(getConfig().oidc), source: oidcSource() });
}

/**
 * Save SSO settings. The client secret is encrypted at rest; an empty
 * `clientSecret` keeps the previously stored one.
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prev = getConfig().oidc ?? ({} as OidcStoredConfig);

  const { encryptSecret } = await import("@/lib/server/crypto");
  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v.trim().slice(0, 1000) : fallback;

  const next: OidcStoredConfig = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : !!prev.enabled,
    provider: body.provider === "ad" ? "ad" : body.provider === "entra" ? "entra" : prev.provider ?? "entra",
    clientId: str(body.clientId, prev.clientId ?? ""),
    tenantId: str(body.tenantId, prev.tenantId ?? ""),
    authorizeUrl: str(body.authorizeUrl, prev.authorizeUrl ?? ""),
    tokenUrl: str(body.tokenUrl, prev.tokenUrl ?? ""),
    // Empty falls back to the Microsoft default at read time (getSsoLabel).
    buttonLabel: str(body.buttonLabel, prev.buttonLabel ?? "").slice(0, 60) || undefined,
    clientSecretEnc:
      typeof body.clientSecret === "string" && body.clientSecret.trim()
        ? encryptSecret(body.clientSecret.trim())
        : prev.clientSecretEnc,
  };

  setConfig({ oidc: next });
  return NextResponse.json({ oidc: publicView(next), source: oidcSource() });
}
