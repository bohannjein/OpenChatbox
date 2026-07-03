export type DocKind = "pdf" | "xlsx";

// "Excel/Tabelle" checked first so a spreadsheet request never matches PDF.
const XLSX_RE =
  /\b(excel|xlsx|spreadsheet|tabellenkalkulation)\b|excel[-\s]?(tabelle|datei|sheet)|als\s+excel|(erstelle|generiere|mach|baue|create|generate|export|exportiere)\b[^.]*\b(excel|tabelle|spreadsheet)\b/i;
const PDF_RE =
  /\bpdf\b|als\s+pdf|(erstelle|generiere|mach|baue|create|generate|export|exportiere)\b[^.]*\bpdf\b/i;

/** Detect a document-generation intent in the user's prompt (or null). */
export function detectDocIntent(text: string): DocKind | null {
  const t = text || "";
  if (XLSX_RE.test(t)) return "xlsx";
  if (PDF_RE.test(t)) return "pdf";
  return null;
}

// The special fenced block the model emits: ```generate-file:pdf\n…\n```
const FENCE = /```generate-file:(pdf|xlsx|excel|csv|docx)[^\n]*\n([\s\S]*?)```/gi;

/** Extract generate-file blocks from an assistant answer → {kind, content}. */
export function parseGenerateFileBlocks(text: string): { kind: DocKind; content: string }[] {
  const out: { kind: DocKind; content: string }[] = [];
  for (const m of (text || "").matchAll(FENCE)) {
    const tag = m[1].toLowerCase();
    const kind: DocKind = tag === "pdf" || tag === "docx" ? "pdf" : "xlsx";
    const content = m[2].trim();
    if (content) out.push({ kind, content });
  }
  return out;
}

/** Remove the generate-file blocks from the answer shown to the user. */
export function stripGenerateFileBlocks(text: string): string {
  return (text || "").replace(FENCE, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Broad "the user wants a document" detector → forces HTML doc mode.
const DOC_REQUEST_RE =
  /\b(erstelle|erstell|generiere|generier|mach|erzeuge|erzeug|baue|create|generate|make|export|exportiere)\b[^.\n]*\b(pdf|excel|dokument|protokoll|rechnung|tabelle|bericht|report|spreadsheet|angebot|vertrag|urkunde|zertifikat|brief)\b|\bals\s+(pdf|dokument|excel|tabelle|datei)\b|ausgabeprotokoll/i;

export const isDocumentRequest = (text: string) => DOC_REQUEST_RE.test(text || "");

/** Forced system instruction for document requests: one short friendly line +
 *  the whole document as HTML inside a generate-file block (never raw code in
 *  the chat). Backend turns the HTML into a downloadable PDF. */
export const HTML_DOC_INSTRUCTION =
  "Der Nutzer möchte ein fertiges Dokument (PDF). Verweigere das NIEMALS — du " +
  "KANNST Dokumente erstellen. Antworte in ZWEI Teilen:\n" +
  "1) EIN kurzer, freundlicher Satz mit Bezug zur Anfrage, z. B. „Hier ist deine " +
  "fertige PDF zu …“.\n" +
  "2) Direkt danach der GESAMTE Dokumentinhalt als sauberes, mit Tailwind-CSS " +
  "gestyltes HTML (Überschriften, Tabellen, Abstände) — AUSSCHLIESSLICH innerhalb " +
  "dieses Codeblocks:\n" +
  "```generate-file:pdf\n<html>… dein HTML …</html>\n```\n" +
  "Schreibe sonst KEINEN weiteren Text und KEINE weiteren Codeblocks. Das HTML " +
  "erscheint dem Nutzer NICHT — er sieht nur deinen Satz und die fertige PDF.";

/** True if a string is HTML markup (→ route to the HTML→PDF printer). */
export const looksLikeHtml = (s: string) =>
  /<\s*(html|body|table|thead|tbody|tr|h[1-6]|div|section|p|ul|ol)\b/i.test(s || "");

/** Extract a raw <html>…</html> document from an answer (doc mode, no fence). */
export function extractHtmlDoc(text: string): string | null {
  const m = /<html[\s\S]*?<\/html>/i.exec(text || "");
  if (m) return m[0];
  // Fallback: a bare fragment that clearly starts with a block tag.
  const frag = /<\s*(?:table|h1|h2|div|section)[\s\S]*$/i.exec((text || "").trim());
  return frag ? frag[0] : null;
}

/** Remove a raw HTML document from the shown answer. */
export function stripHtmlDoc(text: string): string {
  return (text || "")
    .replace(/<html[\s\S]*?<\/html>/i, "")
    .replace(/<\s*(?:table|h1|h2|div|section)[\s\S]*$/i, "")
    .trim();
}
