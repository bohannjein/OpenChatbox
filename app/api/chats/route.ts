import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { getChatsForUser, setChatsForUser } from "@/lib/server/chats";
import { listForUser } from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memberWorkspaceIds = (userId: string) =>
  listForUser(userId).map((w) => w.id);

/** Chat history: the user's personal chats + all their workspaces' shared chats. */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getChatsForUser(user.id, memberWorkspaceIds(user.id)));
}

/** Persist (personal → user file; workspace chats → shared per-workspace file). */
export async function PUT(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    setChatsForUser(user.id, memberWorkspaceIds(user.id), body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 400 }
    );
  }
}
