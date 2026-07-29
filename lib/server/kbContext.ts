import { searchChunks, type KbHit } from "./kb";
import { embedOne } from "./embed";
import { retrievePages, type BookstackPage, type SourceLink } from "./bookstack";

/**
 * Unified knowledge retrieval: local vector store + BookStack wiki in parallel,
 * merged, deduplicated, and formatted into one context block with per-item source
 * labels. Extracted from app/api/kb/unified so the internal route and the public
 * assistant API build context identically.
 *
 * The category allow-list is the security boundary and is a REQUIRED argument:
 * `[]` means "no local documents" (searchChunks treats an empty list as a hard
 * deny), `undefined` means unrestricted. Callers derive it from the caller's
 * identity — a user's granted categories, or an assistant's configured ones.
 */
export interface KbContextRequest {
  query: string;
  /** Allowed local categories. `[]` = none, `undefined` = all. */
  categoryIds: string[] | undefined;
  /** Search the linked wiki too. */
  useBookstack: boolean;
  /** Restrict the wiki to these book ids. `[]`/undefined = whole instance. */
  bookIds?: number[];
  /** Vector hits to fetch (1..12). */
  k?: number;
  /** Wiki pages to read. */
  maxPages?: number;
}

export interface KbContextResult {
  /** Ready-to-prepend system context, or "" when nothing was found. */
  context: string;
  sources: SourceLink[];
  /** Set when a typo/proper-noun correction produced the wiki hits. */
  correctedQuery?: string;
}

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

export async function buildKbContext(r: KbContextRequest): Promise<KbContextResult> {
  const query = r.query.trim();
  if (!query) return { context: "", sources: [] };

  // Run both retrievals concurrently — neither blocks the other.
  const [vector, wiki] = await Promise.all([
    (async (): Promise<KbHit[]> => {
      if (r.categoryIds && r.categoryIds.length === 0) return [];
      try {
        const emb = await embedOne(query);
        return searchChunks(emb, Math.min(Math.max(r.k ?? 8, 1), 12), r.categoryIds);
      } catch {
        return []; // embedding backend down → wiki results can still answer
      }
    })(),
    (async (): Promise<{ pages: BookstackPage[]; correctedQuery?: string }> => {
      if (!r.useBookstack) return { pages: [] };
      try {
        return await retrievePages(query, r.maxPages ?? 3, { bookIds: r.bookIds });
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

  if (!blocks.length)
    return { context: "", sources: [], correctedQuery: wiki.correctedQuery };

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

  return { context, sources, correctedQuery: wiki.correctedQuery };
}
