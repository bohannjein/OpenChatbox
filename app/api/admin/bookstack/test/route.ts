import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { getConfig } from "@/lib/server/config";
import { decryptSecret } from "@/lib/server/crypto";
import { testConnection } from "@/lib/server/bookstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin connection tester. Pings the BookStack REST API (GET /books) and returns
 * { ok, count } or { ok:false, status?, error }. Uses the credentials sent in the
 * body when present (so the admin can test *before* saving), otherwise falls back
 * to the stored config — an empty tokenSecret means "use the saved one".
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const stored = getConfig().bookstack;

  const baseUrl = (typeof body.baseUrl === "string" ? body.baseUrl : stored?.baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  const tokenId = (typeof body.tokenId === "string" ? body.tokenId : stored?.tokenId ?? "").trim();
  const tokenSecret =
    typeof body.tokenSecret === "string" && body.tokenSecret.trim()
      ? body.tokenSecret.trim()
      : decryptSecret(stored?.tokenSecret).trim();
  const allowInsecure =
    typeof body.allowInsecure === "boolean" ? body.allowInsecure : !!stored?.allowInsecure;

  if (!baseUrl || !tokenId || !tokenSecret)
    return NextResponse.json(
      { ok: false, error: "BookStack-URL, Token ID und Token Secret sind erforderlich." },
      { status: 400 }
    );

  const result = await testConnection({
    baseUrl,
    tokenId,
    tokenSecret,
    writeEnabled: false,
    allowInsecure,
  });
  return NextResponse.json(result);
}
