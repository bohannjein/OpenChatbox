import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { allowedCategoryIds } from "@/lib/server/users";
import { allCategoryIds } from "@/lib/server/kb";
import { getBookstackConfig } from "@/lib/server/config";
import { buildKbContext } from "@/lib/server/kbContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified knowledge retrieval for the app's own chat. The merge/dedup/formatting
 * lives in lib/server/kbContext (shared with the public assistant API); this
 * route's job is the ACL: a user only ever sees chunks from categories the admin
 * granted them, decided HERE before any text can reach a context window.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { query?: string; k?: number };
  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!query) return NextResponse.json({ context: "", sources: [] });

  const result = await buildKbContext({
    query,
    categoryIds: allowedCategoryIds(user, allCategoryIds()),
    // App users search the whole wiki (it is behind the same login); only
    // embedded assistants get a per-book restriction.
    useBookstack: !!getBookstackConfig(),
    k: b.k,
  });
  return NextResponse.json(result);
}
