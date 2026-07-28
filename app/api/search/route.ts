import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { webSearch } from "@/lib/server/search";
import { getProperNouns } from "@/lib/server/config";
import { correctProperNouns } from "@/lib/server/spellfix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Run a web search with the admin's active provider (API key stays server-side). */
export async function POST(req: NextRequest) {
  if (!getUser(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { query } = await req.json().catch(() => ({}));
  if (typeof query !== "string" || !query.trim())
    return NextResponse.json({ provider: null, results: [] });
  // Correct mistyped company/person proper nouns against the admin dictionary
  // before the query hits the search provider.
  const { corrected } = correctProperNouns(query, getProperNouns());
  const out = await webSearch(corrected);
  return NextResponse.json(out);
}
