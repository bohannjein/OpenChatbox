import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { searchChunks } from "@/lib/server/kb";
import { embedOne } from "@/lib/server/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retrieve the most relevant knowledge-base chunks for a query. */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as {
    query?: string;
    categoryIds?: string[];
    k?: number;
  };
  if (typeof b.query !== "string" || !b.query.trim())
    return NextResponse.json({ results: [] });
  try {
    const emb = await embedOne(b.query);
    const results = searchChunks(
      user.id,
      emb,
      Math.min(Math.max(b.k ?? 5, 1), 10),
      Array.isArray(b.categoryIds) ? b.categoryIds : undefined
    );
    return NextResponse.json({ results });
  } catch {
    // Embedding backend unavailable → no context (chat still answers).
    return NextResponse.json({ results: [] });
  }
}
