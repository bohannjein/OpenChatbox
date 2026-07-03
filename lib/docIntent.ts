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

/** A full HTML document (not a small snippet) → treat as a document to print. */
export const isFullHtml = (s: string) => /<!doctype html|<html[\s>]/i.test(s || "");

// Any fenced block: ```lang\n…\n```
const ANY_FENCE = /```([^\n]*)\n([\s\S]*?)```/g;

/** True if a fenced block is a document (generate-file tag or full HTML) —
 *  shown as a placeholder, never as raw code, and turned into a file. */
export function isDocBlock(lang: string, content: string): boolean {
  return (lang || "").trim().toLowerCase().startsWith("generate-file") || isFullHtml(content);
}

/**
 * Extract document jobs from ANY fenced block the model produced —
 * ```generate-file:pdf|xlsx``` OR a plain ```html``` with a full HTML document.
 * Robust to models that ignore the special fence.
 */
export function parseDocBlocks(text: string): { kind: DocKind; content: string }[] {
  const out: { kind: DocKind; content: string }[] = [];
  for (const m of (text || "").matchAll(ANY_FENCE)) {
    const lang = m[1].trim().toLowerCase();
    const content = m[2].trim();
    if (!content) continue;
    if (lang.startsWith("generate-file")) {
      const tag = lang.slice("generate-file".length).replace(/^:/, "");
      out.push({ kind: tag === "xlsx" || tag === "excel" || tag === "csv" ? "xlsx" : "pdf", content });
    } else if (isFullHtml(content)) {
      out.push({ kind: "pdf", content });
    }
  }
  return out;
}

/** Remove document blocks from the answer shown to the user. */
export function stripDocBlocks(text: string): string {
  return (text || "")
    .replace(ANY_FENCE, (full, lang: string, content: string) =>
      isDocBlock(lang, content) ? "" : full
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

const HTML_START = /<!doctype html|<html[\s>]/i;
const HTMLISH = /class=|<table|<thead|<tbody|<tr\b|<h[1-6][\s>]|<body|<section|<ul\b|<ol\b/i;

/** Extract an HTML document from an answer: full <html>/<!doctype> region
 *  (closed or unclosed), else a fenced html block, else an HTML-ish fragment. */
export function extractHtmlDoc(text: string): string | null {
  const t = text || "";
  const start = t.search(HTML_START);
  if (start >= 0) {
    const end = t.toLowerCase().lastIndexOf("</html>");
    return end > start ? t.slice(start, end + 7) : t.slice(start);
  }
  // Fenced html/xml block (even if the closing ``` is missing while streaming).
  const f = /```(?:html|xml)?[^\n]*\n([\s\S]*?)(?:```|$)/i.exec(t);
  if (f && HTMLISH.test(f[1])) return f[1].trim();
  return null;
}

/** Remove a raw HTML document from the shown answer. */
export function stripHtmlDoc(text: string): string {
  let t = text || "";
  const start = t.search(HTML_START);
  if (start >= 0) {
    const end = t.toLowerCase().lastIndexOf("</html>");
    t = end > start ? t.slice(0, start) + t.slice(end + 7) : t.slice(0, start);
  }
  return t
    .replace(/```(?:html|xml)?[^\n]*\n[\s\S]*?(?:```|$)/gi, (m) =>
      HTMLISH.test(m) ? "" : m
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
