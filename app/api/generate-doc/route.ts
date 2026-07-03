import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUser } from "@/lib/server/adminAuth";
import { getPlugins } from "@/lib/server/config";
import { generatePdf, generateXlsx, htmlToPdf, slugName } from "@/lib/server/docgen";
import { looksLikeHtml } from "@/lib/docIntent";
import { DATA_DIR } from "@/lib/server/paths";

/** Persist a copy on the server (/data/downloads) — survives via the volume. */
function saveDownload(chatId: string | undefined, name: string, buf: Buffer) {
  try {
    const dir = path.join(DATA_DIR, "downloads");
    fs.mkdirSync(dir, { recursive: true });
    const base = (chatId && /^[\w-]+$/.test(chatId) ? chatId : slugName(name)).slice(0, 80);
    fs.writeFileSync(path.join(dir, `${base}${path.extname(name)}`), buf);
  } catch {
    /* non-fatal — the file is also returned inline as a data URL */
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generate a real file (PDF via pdfkit / XLSX via exceljs) from a chat answer.
 * Gated by the admin master-switch `docGenerator`. Returns the file inline as a
 * base64 data URL so the client can render a download link under the answer.
 */
export async function POST(req: NextRequest) {
  if (!getUser(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getPlugins().docGenerator)
    return NextResponse.json(
      { error: "Dokumenten-Generator ist deaktiviert.", disabled: true },
      { status: 403 }
    );

  const { kind, title, content, chatId } = await req.json().catch(() => ({}));
  const k = kind === "xlsx" ? "xlsx" : kind === "pdf" ? "pdf" : null;
  if (!k)
    return NextResponse.json({ error: "kind muss 'pdf' oder 'xlsx' sein." }, { status: 400 });

  const safeTitle = String(title || "Dokument").slice(0, 80);
  try {
    if (k === "pdf") {
      const c = String(content || "");
      // HTML content → the HTML→PDF printer; plain Markdown → pdf-lib renderer.
      const buf = looksLikeHtml(c)
        ? await htmlToPdf(safeTitle, c)
        : await generatePdf(safeTitle, c);
      const name = `${slugName(safeTitle)}.pdf`;
      saveDownload(chatId, name, buf);
      return NextResponse.json({
        name,
        mime: "application/pdf",
        size: buf.length,
        dataUrl: `data:application/pdf;base64,${buf.toString("base64")}`,
      });
    }
    const buf = await generateXlsx(safeTitle, String(content || ""));
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const name = `${slugName(safeTitle)}.xlsx`;
    saveDownload(chatId, name, buf);
    return NextResponse.json({
      name,
      mime,
      size: buf.length,
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Generierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
