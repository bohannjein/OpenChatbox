import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

/** Office/document formats we extract text from beyond plain text/csv. */
export const OFFICE_EXT = /\.(docx|xlsx|xlsm|xlsb|xls|pptx)$/i;
export const isOfficeFile = (name: string) => OFFICE_EXT.test(name);

const clip = (s: string, max = 200_000) =>
  s.length > max ? s.slice(0, max) + "\n…[gekürzt]" : s;

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

  // xlsx / xls / xlsm / xlsb → each sheet as CSV.
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]).trim();
    return csv ? `# Tabelle: ${name}\n${csv}` : "";
  }).filter(Boolean);
  return clip(parts.join("\n\n"));
}
