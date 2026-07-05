import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { getConfig, setConfig, type ServerConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full instance config INCLUDING secrets (provider apiKeys) — admin only. */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ config: getConfig() });
}

/** Patch the admin-global master config. Whitelisted keys only. */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<ServerConfig> = {};
  if (typeof body.appName === "string") patch.appName = body.appName.slice(0, 80);
  if (typeof body.logoUrl === "string") patch.logoUrl = body.logoUrl.slice(0, 500_000);
  if (typeof body.accentColor === "string") patch.accentColor = body.accentColor.slice(0, 32);
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

  const next = setConfig(patch);
  return NextResponse.json({ config: next });
}
