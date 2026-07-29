import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import { listBooks } from "@/lib/server/bookstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Book list for the per-assistant wiki restriction picker. */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ books: await listBooks() });
  } catch (e) {
    return NextResponse.json(
      { books: [], error: e instanceof Error ? e.message : "BookStack nicht erreichbar." },
      { status: 200 }
    );
  }
}
