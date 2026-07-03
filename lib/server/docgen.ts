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

// Strip inline markdown markers (bold/italic/code) for clean plain rendering.
const inline = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*(.+?)\*/g, "$1");

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l);
const splitRow = (l: string) =>
  l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));

/**
 * Render Markdown (headings, lists, tables, paragraphs) into a PDF via pdf-lib.
 * Standard fonts embed without external .afm files → works in the bundled
 * standalone/Docker server.
 */
export async function generatePdf(title: string, content: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = A4[0] - MARGIN * 2;

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const need = (h: number) => {
    if (y - h < MARGIN) {
      page = pdf.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };
  const line = (text: string, size: number, f: PDFFont, x = MARGIN, gap = 1.45) => {
    for (const ln of wrap(winAnsi(text), f, size, maxWidth - (x - MARGIN))) {
      need(size * gap);
      if (ln) page.drawText(ln, { x, y, size, font: f, color: rgb(0.12, 0.12, 0.12) });
      y -= size * gap;
    }
  };

  const table = (rows: string[][]) => {
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = maxWidth / cols;
    const size = 10;
    rows.forEach((r, ri) => {
      need(size * 1.6);
      const f = ri === 0 ? bold : font;
      for (let c = 0; c < cols; c++) {
        const cell = winAnsi(r[c] ?? "");
        let txt = cell;
        while (txt && font.widthOfTextAtSize(txt, size) > cw - 8)
          txt = txt.slice(0, -1);
        page.drawText(txt === cell ? cell : txt + "…", {
          x: MARGIN + c * cw + 2,
          y,
          size,
          font: f,
          color: rgb(0.12, 0.12, 0.12),
        });
      }
      y -= size * 1.1;
      // rule under the header row
      page.drawLine({
        start: { x: MARGIN, y: y + 4 },
        end: { x: MARGIN + maxWidth, y: y + 4 },
        thickness: ri === 0 ? 0.8 : 0.3,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 4;
    });
    y -= 6;
  };

  if (title) {
    line(title, 20, bold);
    y -= 6;
  }

  const src = (content || "").split("\n");
  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const l = raw.trim();

    if (!l) {
      y -= 6;
      continue;
    }
    // Table block
    if (isTableRow(l)) {
      const block: string[][] = [];
      while (i < src.length && isTableRow(src[i].trim())) {
        if (!isTableSep(src[i].trim())) block.push(splitRow(src[i]));
        i++;
      }
      i--;
      if (block.length) table(block);
      continue;
    }
    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const sizes = [20, 16, 13, 12];
      y -= 4;
      line(inline(h[2]), sizes[h[1].length - 1], bold);
      y -= 2;
      continue;
    }
    // Bullet / numbered list
    const b = /^([-*]|\d+\.)\s+(.*)$/.exec(l);
    if (b) {
      const marker = /^\d+\./.test(b[1]) ? b[1] : "•";
      line(`${marker} ${inline(b[2])}`, 11, font, MARGIN + 12);
      continue;
    }
    // Paragraph
    line(inline(l), 11, font);
  }

  return Buffer.from(await pdf.save());
}

/** Best-effort: turn JSON / a markdown table / CSV / lines into a grid of cells. */
function toRows(content: string): string[][] {
  const t = content.trim();
  // JSON array → array of objects (keys = columns) | array of arrays | primitives
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr) && arr.length) {
        if (Array.isArray(arr[0]))
          return arr.map((r) => (r as unknown[]).map((c) => String(c ?? "")));
        if (arr[0] && typeof arr[0] === "object") {
          const cols = [...new Set(arr.flatMap((o) => Object.keys(o)))];
          return [
            cols,
            ...arr.map((o) => cols.map((k) => String((o as Record<string, unknown>)[k] ?? ""))),
          ];
        }
        return arr.map((v) => [String(v)]);
      }
    } catch {
      /* not valid JSON → fall through to text parsing */
    }
  }
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

// ── HTML → PDF ──────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function stripTags(s: string): string {
  return decodeEntities(String(s).replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Convert HTML to structured Markdown (headings, lists, tables) for pdf-lib. */
function htmlToMarkdown(html: string): string {
  let h = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  h = h.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m, row: string) => {
    const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) =>
      stripTags(c[2])
    );
    return cells.length ? `\n| ${cells.join(" | ")} |\n` : "\n";
  });
  h = h.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t) => `\n# ${stripTags(t)}\n`);
  h = h.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\n## ${stripTags(t)}\n`);
  h = h.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_m, t) => `\n### ${stripTags(t)}\n`);
  h = h.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `\n- ${stripTags(t)}`);
  h = h.replace(/<\/(p|div|section|ul|ol|table|h[1-6])>/gi, "\n\n");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  return stripTags(h).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Render HTML to an A4 PDF. With PUPPETEER=1 (+ a Chromium available) it uses a
 * headless browser for full Tailwind/CSS fidelity; otherwise it degrades to a
 * structured pdf-lib render (headings/lists/tables) so it always produces a PDF.
 */
export async function htmlToPdf(title: string, html: string): Promise<Buffer> {
  if (process.env.PUPPETEER === "1") {
    try {
      // Opaque require so the bundler never tries to resolve puppeteer at build.
      const req = eval("require") as NodeRequire;
      const puppeteer = req("puppeteer");
      const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
      const page = await browser.newPage();
      const doc = /<html/i.test(html)
        ? html
        : `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="p-8">${html}</body></html>`;
      await page.setContent(doc, { waitUntil: "networkidle0" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "15mm", bottom: "18mm", left: "15mm" },
      });
      await browser.close();
      return Buffer.from(buf);
    } catch {
      /* Chromium missing/failed → fall back to the pure-JS renderer */
    }
  }
  return generatePdf(title, htmlToMarkdown(html));
}

export const slugName = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "dokument";
