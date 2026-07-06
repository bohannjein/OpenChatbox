import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { getConfig, setConfig, type BookstackConfig } from "@/lib/server/config";
import { encryptSecret } from "@/lib/server/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current BookStack settings WITHOUT the token secret (only whether one is set). */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = getConfig().bookstack;
  return NextResponse.json({
    bookstack: {
      enabled: !!b?.enabled,
      writeEnabled: !!b?.writeEnabled,
      allowInsecure: !!b?.allowInsecure,
      baseUrl: b?.baseUrl ?? "",
      tokenId: b?.tokenId ?? "",
      hasSecret: !!(b?.tokenSecret && b.tokenSecret.length),
    },
  });
}

/**
 * Save BookStack settings. The token secret is encrypted at rest; an empty
 * `tokenSecret` keeps the previously stored one (so the admin never has to
 * re-enter it just to toggle a flag).
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prev = getConfig().bookstack ?? ({} as BookstackConfig);

  const next: BookstackConfig = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : !!prev.enabled,
    writeEnabled:
      typeof body.writeEnabled === "boolean" ? body.writeEnabled : !!prev.writeEnabled,
    allowInsecure:
      typeof body.allowInsecure === "boolean" ? body.allowInsecure : !!prev.allowInsecure,
    baseUrl:
      typeof body.baseUrl === "string"
        ? body.baseUrl.trim().replace(/\/+$/, "").slice(0, 500)
        : prev.baseUrl,
    tokenId:
      typeof body.tokenId === "string" ? body.tokenId.trim().slice(0, 200) : prev.tokenId,
    tokenSecret:
      typeof body.tokenSecret === "string" && body.tokenSecret.trim()
        ? encryptSecret(body.tokenSecret.trim())
        : prev.tokenSecret,
  };

  setConfig({ bookstack: next });
  return NextResponse.json({
    bookstack: {
      enabled: next.enabled,
      writeEnabled: next.writeEnabled,
      allowInsecure: !!next.allowInsecure,
      baseUrl: next.baseUrl ?? "",
      tokenId: next.tokenId ?? "",
      hasSecret: !!(next.tokenSecret && next.tokenSecret.length),
    },
  });
}
