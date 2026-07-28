import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { allowedCategoryIds } from "@/lib/server/users";
import { searchChunks, allCategoryIds, type KbHit } from "@/lib/server/kb";
import { embedOne } from "@/lib/server/embed";
import { retrievePages, type BookstackPage, type SourceLink } from "@/lib/server/bookstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Coarse doc-type label from a filename ("Server_Setup.pdf" → "PDF"). */
function docType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return "PDF";
    case "xlsx":
    case "csv":
      return "Tabelle";
    case "docx":
      return "Word";
    case "pptx":
      return "Präsentation";
    case "md":
    case "txt":
      return "Textdatei";
    default:
      return "Dokument";
  }
}

/** Normalized signature for dedup across sources (first ~140 significant chars). */
function sig(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim().slice(0, 140);
}

/**
 * Unified knowledge retrieval. Runs the local vector store (RAG, restricted to
 * the caller's permitted categories) AND the linked BookStack wiki IN PARALLEL,
 * merges both result sets, drops duplicates, and returns one consolidated context
 * block with explicit per-item source labels
 * ([Quelle: BookStack-Seite: …] / [Quelle: PDF: …]) for the LLM.
 *
 * The category ACL is enforced HERE, before any text is injected into context:
 * a user only ever sees chunks from categories the admin granted them.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { query?: string; k?: number };
  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!query) return NextResponse.json({ context: "", sources: [] });

  const allowed = allowedCategoryIds(user, allCategoryIds());

  // Run both retrievals concurrently — neither blocks the other.
  const [vector, wiki] = await Promise.all([
    (async (): Promise<KbHit[]> => {
      try {
        const emb = await embedOne(query);
        return searchChunks(emb, Math.min(Math.max(b.k ?? 8, 1), 12), allowed);
      } catch {
        return []; // embedding backend down → wiki results can still answer
      }
    })(),
    (async (): Promise<{ pages: BookstackPage[]; correctedQuery?: string }> => {
      try {
        return await retrievePages(query);
      } catch {
        return { pages: [] };
      }
    })(),
  ]);

  // Merge with dedup. Each item carries a clear, uniform source label.
  const seen = new Set<string>();
  const blocks: string[] = [];
  const sources: SourceLink[] = [];

  for (const p of wiki.pages) {
    const s = sig(p.body);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    blocks.push(`[Quelle: BookStack-Seite: ${p.title}]\n${p.body}`);
    if (p.url) sources.push({ title: `BookStack: ${p.title}`, url: p.url });
  }
  for (const h of vector) {
    const s = sig(h.text);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    blocks.push(`[Quelle: ${docType(h.docName)}: ${h.docName}]\n${h.text}`);
  }

  if (!blocks.length) return NextResponse.json({ context: "", sources: [], correctedQuery: wiki.correctedQuery });

  const correctionNote = wiki.correctedQuery
    ? `Hinweis: Der ursprüngliche Suchbegriff „${query}" wurde automatisch zu ` +
      `„${wiki.correctedQuery}" korrigiert. Weise den Nutzer charmant auf diese ` +
      `Tippfehler-Korrektur hin.\n\n`
    : "";

  const context =
    correctionNote +
    "Konsolidierte Auszüge aus der Wissensdatenbank (lokale Dokumente + BookStack-Wiki). " +
    "Beantworte die Frage AUSSCHLIESSLICH auf Basis dieser Auszüge und belege JEDE Aussage " +
    "sichtbar mit der jeweiligen Quelle in eckigen Klammern (z. B. [Quelle: BookStack-Seite: …] " +
    "oder [Quelle: PDF: …]). Wenn die Auszüge die Frage NICHT beantworten, sage klar, dass du " +
    "dazu nichts in der Wissensdatenbank gefunden hast, und erfinde nichts. Gib NICHT deinen " +
    "Denkprozess oder deine Suchschritte aus — antworte nur mit dem Ergebnis.\n\n" +
    blocks.join("\n\n---\n\n");

  return NextResponse.json({ context, sources, correctedQuery: wiki.correctedQuery });
}
