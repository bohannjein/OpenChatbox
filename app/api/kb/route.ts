import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import {
  canManageKb,
  allowedCategoryIds,
  grantCategory,
} from "@/lib/server/users";
import {
  listKb,
  addCategory,
  deleteCategory,
  addDocument,
  deleteDocument,
  chunkText,
  allCategoryIds,
} from "@/lib/server/kb";
import { embed } from "@/lib/server/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNKS = 300;

/** List categories + documents the caller is allowed to see (admins: all). */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = allowedCategoryIds(user, allCategoryIds());
  return NextResponse.json(listKb(allowed));
}

/** Add a category, or index a document. Restricted to admins + powerusers. */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageKb(user))
    return NextResponse.json(
      { error: "Nur Administratoren/Poweruser dürfen die Wissensdatenbank verwalten." },
      { status: 403 }
    );
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.kind === "category") {
    if (typeof b.name !== "string" || !b.name.trim())
      return NextResponse.json({ error: "Name erforderlich." }, { status: 400 });
    const category = addCategory(b.name);
    // The category IS the permission. A non-admin creator is auto-granted access
    // to what they just made (admins see everything already).
    if (user.role !== "admin") grantCategory(user.id, category.id);
    return NextResponse.json({ category });
  }

  if (b.kind === "document") {
    const categoryId = String(b.categoryId ?? "");
    const name = String(b.name ?? "Dokument");
    const text = String(b.text ?? "");
    if (!categoryId) return NextResponse.json({ error: "categoryId erforderlich." }, { status: 400 });
    // Only into a category the caller may access (admins: any).
    const allowed = allowedCategoryIds(user, allCategoryIds());
    if (!allowed.includes(categoryId))
      return NextResponse.json({ error: "Keine Berechtigung für diese Kategorie." }, { status: 403 });
    if (!text.trim()) return NextResponse.json({ error: "Kein Textinhalt extrahiert." }, { status: 400 });

    const chunks = chunkText(text).slice(0, MAX_CHUNKS);
    if (chunks.length === 0)
      return NextResponse.json({ error: "Kein indexierbarer Text." }, { status: 400 });
    try {
      const embeddings = await embed(chunks);
      const doc = addDocument(categoryId, name, chunks, embeddings);
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

/** Delete a category (+ its docs/chunks) or a single document (admins/powerusers). */
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageKb(user))
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  const cat = req.nextUrl.searchParams.get("category");
  const doc = req.nextUrl.searchParams.get("document");
  const allowed = allowedCategoryIds(user, allCategoryIds());
  if (cat) {
    if (!allowed.includes(cat))
      return NextResponse.json({ error: "Keine Berechtigung für diese Kategorie." }, { status: 403 });
    return NextResponse.json({ deleted: deleteCategory(cat) });
  }
  if (doc) return NextResponse.json({ deleted: deleteDocument(doc) });
  return NextResponse.json({ error: "category oder document erforderlich." }, { status: 400 });
}
