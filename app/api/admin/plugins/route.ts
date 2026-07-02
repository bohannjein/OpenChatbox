import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { getPlugins, setPlugins, type PluginFlags } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ plugins: getPlugins() });
}

export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const patch: Partial<PluginFlags> = {};
  for (const k of ["officeParser", "ocrEngine", "docGenerator"] as const)
    if (typeof body[k] === "boolean") patch[k] = body[k];
  return NextResponse.json({ plugins: setPlugins(patch) });
}
