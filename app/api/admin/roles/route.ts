import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { listRoles, upsertRole, deleteRole } from "@/lib/server/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ roles: listRoles() });
}

export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body.name !== "string")
    return NextResponse.json({ error: "name erforderlich" }, { status: 400 });
  const role = upsertRole({
    id: typeof body.id === "string" ? body.id : undefined,
    name: body.name,
    permissions: Array.isArray(body.permissions) ? body.permissions : [],
  });
  return NextResponse.json({ role });
}

export async function DELETE(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const ok = deleteRole(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
