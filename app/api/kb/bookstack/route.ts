import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { retrieveContext } from "@/lib/server/bookstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deterministic BookStack retrieval for the knowledge-base toggle: searches the
 * wiki and returns a context block + clickable sources for the query. Empty when
 * BookStack is disabled/unconfigured or nothing relevant is found.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { query?: string };
  if (typeof b.query !== "string" || !b.query.trim())
    return NextResponse.json({ context: "", sources: [] });

  const { text, sources, correctedQuery } = await retrieveContext(b.query);
  return NextResponse.json({ context: text, sources, correctedQuery });
}
