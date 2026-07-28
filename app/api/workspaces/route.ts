import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import {
  listForUser,
  createWorkspace,
  deleteWorkspace,
} from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Workspaces the caller is a member of. */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ workspaces: listForUser(user.id) });
}

/** Create a workspace owned by the caller. */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const ws = createWorkspace(String(name ?? ""), user.id);
  return NextResponse.json({ workspace: ws });
}

/** Delete a workspace the caller owns (?id=). */
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const ok = deleteWorkspace(id, user.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
