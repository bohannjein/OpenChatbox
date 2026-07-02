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
