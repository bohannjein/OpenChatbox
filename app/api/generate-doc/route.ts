import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { getPlugins } from "@/lib/server/config";
import { generatePdf, generateXlsx, slugName } from "@/lib/server/docgen";

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

  const { kind, title, content } = await req.json().catch(() => ({}));
  const k = kind === "xlsx" ? "xlsx" : kind === "pdf" ? "pdf" : null;
  if (!k)
    return NextResponse.json({ error: "kind muss 'pdf' oder 'xlsx' sein." }, { status: 400 });

  const safeTitle = String(title || "Dokument").slice(0, 80);
  try {
    if (k === "pdf") {
      const buf = await generatePdf(safeTitle, String(content || ""));
      return NextResponse.json({
        name: `${slugName(safeTitle)}.pdf`,
        mime: "application/pdf",
        size: buf.length,
        dataUrl: `data:application/pdf;base64,${buf.toString("base64")}`,
      });
    }
    const buf = await generateXlsx(safeTitle, String(content || ""));
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return NextResponse.json({
      name: `${slugName(safeTitle)}.xlsx`,
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
