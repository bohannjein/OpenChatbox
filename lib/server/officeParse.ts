import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

/** Office/document formats we extract text from beyond plain text/csv. */
export const OFFICE_EXT = /\.(docx|xlsx|xlsm|xlsb|xls|pptx)$/i;
export const isOfficeFile = (name: string) => OFFICE_EXT.test(name);

const clip = (s: string, max = 500_000) =>
  s.length > max ? s.slice(0, max) + "\n…[gekürzt]" : s;

const MAX_ROWS = 5000;
const MAX_CELLS = 40_000;

/**
 * Render a worksheet to retrieval-friendly text for RAG. Handles the common
 * cross/matrix table (row labels down the left, property headers across the
 * top): EVERY intersection is emitted as a standalone fact that carries both
 * the row label AND the column header —
 *   "Hamburg — NAS: 10.0.0.5"
 * so a query like "IP der NAS in Hamburg" matches the exact cell. A compact
 * per-row line is added too for whole-row context. Falls back to pipe-joined
 * cells when the sheet has no header labels.
 */
function sheetToText(name: string, sheet: XLSX.WorkSheet): string {
  // raw:false → dates/numbers as their displayed strings; defval keeps columns
  // aligned; blankrows:false drops empty rows.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });
  if (!rows.length) return "";

  const cellStr = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim();
  const header = (rows[0] ?? []).map(cellStr);
  // Treat the first row as a header only if it carries non-numeric labels.
  const hasHeader = header.some((h) => h && isNaN(Number(h)));
  const body = hasHeader ? rows.slice(1) : rows;
  // Name of the row-label column (top-left cell), e.g. "Filiale". Blank corner
  // cells are common in matrix tables → fall back to a neutral label.
  const rowLabelName = (hasHeader && header[0]) || "Eintrag";

  const lines: string[] = [`# Tabelle: ${name}`];
  let cellCount = 0;
  for (const row of body.slice(0, MAX_ROWS)) {
    const cells = (row ?? []).map(cellStr);
    if (cells.every((c) => !c)) continue; // skip empty rows

    if (!hasHeader) {
      lines.push(cells.filter(Boolean).join(" | "));
      continue;
    }

    const label = cells[0] || rowLabelName;
    // One explicit, self-describing fact per cell (intersection), carrying the
    // row label + column header — e.g. "Hamburg — NAS: 10.0.0.5". This is all
    // retrieval needs and keeps the index compact (no redundant row echo).
    let any = false;
    for (let i = 1; i < cells.length; i++) {
      if (!cells[i]) continue;
      lines.push(`${label} — ${header[i] || `Spalte ${i + 1}`}: ${cells[i]}`);
      any = true;
      if (++cellCount >= MAX_CELLS) break;
    }
    // Row that only has a label (no other cells) → keep the label itself.
    if (!any) lines.push(`${rowLabelName}: ${label}`);
    if (cellCount >= MAX_CELLS) {
      lines.push("…[gekürzt]");
      break;
    }
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

/**
 * Extract structured text from an Office file (server-side). Throws on failure
 * so the caller can attach a clean note instead of raw content.
 */
export async function parseOffice(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();

  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return clip(value.trim());
  }

  if (ext === "pptx") {
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const n = (s: string) => Number(s.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return n(a) - n(b);
      });
    const out: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const xml = await zip.files[slides[i]].async("string");
      const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      if (runs.length) out.push(`--- Folie ${i + 1} ---\n${runs.join(" ")}`);
    }
    return clip(out.join("\n\n").trim());
  }

  // xlsx / xls / xlsm / xlsb → each sheet as self-describing rows.
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const parts = wb.SheetNames.map((name) =>
    sheetToText(name, wb.Sheets[name])
  ).filter(Boolean);
  return clip(parts.join("\n\n"));
}
