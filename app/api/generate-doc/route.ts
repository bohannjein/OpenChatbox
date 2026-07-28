import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { getPlugins } from "@/lib/server/config";
import { generatePdf, generateXlsx, htmlToPdf, slugName } from "@/lib/server/docgen";
import { saveFile } from "@/lib/server/files";
import { looksLikeHtml } from "@/lib/docIntent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generate a real file (PDF via pdf-lib / XLSX via exceljs) from a chat answer.
 * Gated by the admin master-switch `docGenerator`. Persists the bytes in the
 * global file store AND returns the file inline as a base64 data URL so the
 * client can render a download link under the answer.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getPlugins().docGenerator)
    return NextResponse.json(
      { error: "Dokumenten-Generator ist deaktiviert.", disabled: true },
      { status: 403 }
    );

  const { kind, title, content, chatId, messageId } = await req.json().catch(() => ({}));
  const k = kind === "xlsx" ? "xlsx" : kind === "pdf" ? "pdf" : null;
  if (!k)
    return NextResponse.json({ error: "kind muss 'pdf' oder 'xlsx' sein." }, { status: 400 });

  const c = String(content || "");
  // Filename from the document's own <title>/<h1>/# heading — NOT the prompt.
  const docTitle =
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(c)?.[1] ||
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(c)?.[1] ||
    /^#\s+(.+)$/m.exec(c)?.[1] ||
    String(title || "");
  const base = slugName(docTitle.replace(/<[^>]+>/g, "").trim()) || "dokument";
  try {
    if (k === "pdf") {
      // Empty title → don't inject the prompt as a heading; the document
      // carries its own heading.
      const buf = looksLikeHtml(c) ? await htmlToPdf("", c) : await generatePdf("", c);
      const name = `${base}.pdf`;
      const mime = "application/pdf";
      const meta = saveFile(
        user.id,
        { chatId: String(chatId ?? ""), messageId: String(messageId ?? ""), name, kind: "pdf", source: "generated", mime },
        buf
      );
      return NextResponse.json({
        fileId: meta.id,
        name,
        mime,
        size: buf.length,
        dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      });
    }
    const buf = await generateXlsx("", c);
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const name = `${base}.xlsx`;
    const meta = saveFile(
      user.id,
      { chatId: String(chatId ?? ""), messageId: String(messageId ?? ""), name, kind: "other", source: "generated", mime },
      buf
    );
    return NextResponse.json({
      fileId: meta.id,
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
