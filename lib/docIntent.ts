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
