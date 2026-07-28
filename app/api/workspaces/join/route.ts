import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { joinByInvite } from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Join a workspace via its invite token. Caller must be logged in. */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  const ws = joinByInvite(String(token || ""), user.id);
  if (!ws)
    return NextResponse.json({ error: "Ungültiger Einladungslink." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    workspace: { id: ws.id, name: ws.name },
  });
}
