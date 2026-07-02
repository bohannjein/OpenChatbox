import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import ExcelJS from "exceljs";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

// Standard PDF fonts are WinAnsi-encoded; drop characters they can't encode
// (emoji, non-latin) so text drawing never throws.
const winAnsi = (s: string) => (s || "").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * Render text (title + body) into a PDF via pdf-lib. Unlike pdfkit, standard
 * fonts are embedded without external .afm data files → works in the bundled
 * standalone/Docker server.
 */
export async function generatePdf(title: string, content: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = A4[0] - MARGIN * 2;

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const draw = (text: string, size: number, f: PDFFont) => {
    for (const line of wrap(winAnsi(text), f, size, maxWidth)) {
      if (y < MARGIN) {
        page = pdf.addPage(A4);
        y = A4[1] - MARGIN;
      }
      if (line) page.drawText(line, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size * 1.45;
    }
  };

  if (title) {
    draw(title, 18, bold);
    y -= 8;
  }
  draw(content || "", 11, font);
  return Buffer.from(await pdf.save());
}

/** Best-effort: turn a markdown table / CSV / lines into a grid of cells. */
function toRows(content: string): string[][] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const md = lines.filter((l) => l.includes("|"));
  if (md.length >= 2) {
    return md
      .filter((l) => !/^\|?[\s:|-]+\|?$/.test(l)) // drop |---|---| separators
      .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  }
  if (lines.some((l) => l.includes(","))) return lines.map((l) => l.split(",").map((c) => c.trim()));
  return lines.map((l) => [l]);
}

/** Build an .xlsx buffer from the answer content via exceljs. */
export async function generateXlsx(title: string, content: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((title || "Daten").slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  const rows = toRows(content || "");
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    if (i === 0) row.font = { bold: true };
  });
  ws.columns.forEach((c) => {
    c.width = 24;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const slugName = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "dokument";
