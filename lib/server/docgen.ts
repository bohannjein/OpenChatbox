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

type Block =
  | { t: "title"; text: string }
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "li"; text: string }
  | { t: "table"; rows: string[][] }
  | { t: "space" };

const H_SIZES = [17, 14, 12.5, 11.5]; // h1..h4

/** Parse Markdown into a flat block list. */
function parseBlocks(title: string, content: string): Block[] {
  const b: Block[] = [];
  if (title) b.push({ t: "title", text: title });
  const src = (content || "").split("\n");
  for (let i = 0; i < src.length; i++) {
    const l = src[i].trim();
    if (!l) {
      b.push({ t: "space" });
      continue;
    }
    if (isTableRow(l)) {
      const rows: string[][] = [];
      while (i < src.length && isTableRow(src[i].trim())) {
        if (!isTableSep(src[i].trim())) rows.push(splitRow(src[i]));
        i++;
      }
      i--;
      if (rows.length) b.push({ t: "table", rows });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      b.push({ t: "h", level: h[1].length, text: inline(h[2]) });
      continue;
    }
    const li = /^([-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      const marker = /^\d+\./.test(li[1]) ? li[1] : "•";
      b.push({ t: "li", text: `${marker} ${inline(li[2])}` });
      continue;
    }
    b.push({ t: "p", text: inline(l) });
  }
  return b;
}

/**
 * Render Markdown (headings, lists, tables, paragraphs) into a nicely typeset
 * PDF via pdf-lib. Auto-fits to a SINGLE A4 page by scaling font sizes/spacing
 * (down to ~0.6×); only spills to more pages when even that won't fit.
 */
export async function generatePdf(title: string, content: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const M = 56;
  const [W, H] = A4;
  const usableW = W - M * 2;
  const usableH = H - M * 2;
  const blocks = parseBlocks(title, content);
  const INK = rgb(0.13, 0.15, 0.18);
  const HEAD = rgb(0.1, 0.11, 0.13);
  const ACCENT = rgb(0.06, 0.64, 0.5);

  // Estimate total height at a scale (wrap at the scaled size).
  const measure = (s: number): number => {
    let h = 0;
    for (const blk of blocks) {
      if (blk.t === "space") h += 6 * s;
      else if (blk.t === "title") {
        const sz = 22 * s;
        h += wrap(winAnsi(blk.text), bold, sz, usableW).length * sz * 1.25 + 12 * s;
      } else if (blk.t === "h") {
        const sz = H_SIZES[blk.level - 1] * s;
        h += 6 * s + wrap(winAnsi(blk.text), bold, sz, usableW).length * sz * 1.3;
      } else if (blk.t === "li") {
        const sz = 10.5 * s;
        h += wrap(winAnsi(blk.text), font, sz, usableW - 14).length * sz * 1.4;
      } else if (blk.t === "table") {
        h += blk.rows.length * 9.5 * s * 1.9 + 8 * s;
      } else {
        const sz = 10.5 * s;
        h += wrap(winAnsi(blk.text), font, sz, usableW).length * sz * 1.5;
      }
    }
    return h;
  };

  const est = measure(1);
  const scale = est <= usableH ? 1 : Math.max(0.6, usableH / est);

  let page = pdf.addPage(A4);
  let y = H - M;
  const need = (dh: number) => {
    if (y - dh < M) {
      page = pdf.addPage(A4);
      y = H - M;
    }
  };
  const draw = (text: string, sz: number, f: PDFFont, x: number, gap: number, color = INK) => {
    for (const ln of wrap(winAnsi(text), f, sz, usableW - (x - M))) {
      need(sz * gap);
      if (ln) page.drawText(ln, { x, y, size: sz, font: f, color });
      y -= sz * gap;
    }
  };
  const drawTable = (rows: string[][]) => {
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = usableW / cols;
    const sz = 9.5 * scale;
    const rowH = sz * 1.9;
    rows.forEach((r, ri) => {
      need(rowH);
      if (ri === 0)
        page.drawRectangle({
          x: M,
          y: y - rowH + sz,
          width: usableW,
          height: rowH,
          color: rgb(0.95, 0.96, 0.97),
        });
      const f = ri === 0 ? bold : font;
      for (let c = 0; c < cols; c++) {
        let cell = winAnsi(r[c] ?? "");
        while (cell && font.widthOfTextAtSize(cell, sz) > cw - 8) cell = cell.slice(0, -1);
        page.drawText(cell, { x: M + c * cw + 4, y: y - sz, size: sz, font: f, color: INK });
      }
      y -= rowH;
      page.drawLine({
        start: { x: M, y: y + sz * 0.6 },
        end: { x: M + usableW, y: y + sz * 0.6 },
        thickness: ri === 0 ? 0.8 : 0.3,
        color: rgb(0.78, 0.8, 0.82),
      });
    });
    y -= 8 * scale;
  };

  for (const blk of blocks) {
    if (blk.t === "space") y -= 6 * scale;
    else if (blk.t === "title") {
      const sz = 22 * scale;
      draw(blk.text, sz, bold, M, 1.25, HEAD);
      y -= 3 * scale;
      page.drawLine({
        start: { x: M, y: y + 2 },
        end: { x: M + usableW, y: y + 2 },
        thickness: 1.2,
        color: ACCENT,
      });
      y -= 10 * scale;
    } else if (blk.t === "h") {
      y -= 6 * scale;
      draw(blk.text, H_SIZES[blk.level - 1] * scale, bold, M, 1.3, HEAD);
      y -= 2 * scale;
    } else if (blk.t === "li") {
      draw(blk.text, 10.5 * scale, font, M + 6, 1.4);
    } else if (blk.t === "table") {
      drawTable(blk.rows);
    } else {
      draw(blk.text, 10.5 * scale, font, M, 1.5);
    }
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
  return decodeEntities(
    String(s)
      .replace(/<[^>]*>/g, " ") // complete tags
      .replace(/<[^>]*$/g, " ") // trailing unclosed tag (e.g. "<td")
  )
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
