import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import {
  listKb,
  addCategory,
  deleteCategory,
  addDocument,
  deleteDocument,
  chunkText,
} from "@/lib/server/kb";
import { embed } from "@/lib/server/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNKS = 300;

/** List the user's categories + documents (no embeddings). */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(listKb(user.id));
}

/** Add a category, or index a document (chunk + embed + store). */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.kind === "category") {
    if (typeof b.name !== "string" || !b.name.trim())
      return NextResponse.json({ error: "Name erforderlich." }, { status: 400 });
    return NextResponse.json({ category: addCategory(user.id, b.name) });
  }

  if (b.kind === "document") {
    const categoryId = String(b.categoryId ?? "");
    const name = String(b.name ?? "Dokument");
    const text = String(b.text ?? "");
    if (!categoryId) return NextResponse.json({ error: "categoryId erforderlich." }, { status: 400 });
    if (!text.trim()) return NextResponse.json({ error: "Kein Textinhalt extrahiert." }, { status: 400 });

    const chunks = chunkText(text).slice(0, MAX_CHUNKS);
    if (chunks.length === 0)
      return NextResponse.json({ error: "Kein indexierbarer Text." }, { status: 400 });
    try {
      const embeddings = await embed(chunks);
      const doc = addDocument(user.id, categoryId, name, chunks, embeddings);
      return NextResponse.json({ document: doc });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Indexierung fehlgeschlagen." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}

/** Delete a category (+ its docs/chunks) or a single document. */
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cat = req.nextUrl.searchParams.get("category");
  const doc = req.nextUrl.searchParams.get("document");
  if (cat) return NextResponse.json({ deleted: deleteCategory(user.id, cat) });
  if (doc) return NextResponse.json({ deleted: deleteDocument(user.id, doc) });
  return NextResponse.json({ error: "category oder document erforderlich." }, { status: 400 });
}
