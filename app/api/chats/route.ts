import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { getChats, setChats } from "@/lib/server/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The current user's server-stored chat history. */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getChats(user.id));
}

/** Persist the user's chat history (write-through from the client). */
export async function PUT(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const data = setChats(user.id, body);
    return NextResponse.json({ ok: true, count: data.chats.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 400 }
    );
  }
}
