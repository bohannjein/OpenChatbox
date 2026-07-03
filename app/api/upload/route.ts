import { NextRequest, NextResponse } from "next/server";
import { kindOf, type Attachment, type AttachmentKind } from "@/lib/files";
import { isOfficeFile, parseOffice } from "@/lib/server/officeParse";
import { getPlugins } from "@/lib/server/config";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-file cap. Base64-inlined images bloat the later chat request, so keep
// uploads sane. Reject bigger ones with a clean JSON error, not a stack trace.
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const TEXT_KINDS = new Set<AttachmentKind>(["text"]);

/**
 * File upload endpoint. Parses multipart/form-data via req.formData() and ALWAYS
 * responds with a clean JSON object: { files: Attachment[] } on success, or
 * { error: string } on failure — never HTML/plaintext (which broke the client's
 * response.json() with "invalid json").
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data"))
    return NextResponse.json(
      { error: "Erwarte multipart/form-data." },
      { status: 415 }
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: `Form-Data konnte nicht gelesen werden: ${
          e instanceof Error ? e.message : String(e)
        }` },
      { status: 400 }
    );
  }

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  if (entries.length === 0)
    return NextResponse.json({ error: "Keine Datei empfangen." }, { status: 400 });

  const files: Attachment[] = [];
  for (const file of entries) {
    if (file.size > MAX_BYTES) {
      files.push({
        id: randomUUID(),
        name: file.name,
        size: file.size,
        kind: "other",
        note: `Datei zu groß (${(file.size / 1048576).toFixed(1)} MB, max ${
          MAX_BYTES / 1048576
        } MB).`,
      });
      continue;
    }
    const kind = kindOf(file);
    const base: Attachment = {
      id: randomUUID(),
      name: file.name,
      size: file.size,
      kind,
    };
    try {
      if (kind === "image") {
        const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        const mime = file.type || "image/png";
        files.push({ ...base, dataUrl: `data:${mime};base64,${b64}` });
      } else if (isOfficeFile(file.name)) {
        // .docx/.xlsx/.pptx → structured text extraction (mammoth/xlsx/jszip),
        // gated by the admin "Office-Parser" master-switch.
        if (getPlugins().officeParser)
          files.push({ ...base, kind: "text", text: await parseOffice(file) });
        else
          files.push({ ...base, note: "Office-Parser ist serverseitig deaktiviert." });
      } else if (TEXT_KINDS.has(kind)) {
        files.push({ ...base, text: await file.text() });
      } else if (kind === "pdf") {
        files.push({
          ...base,
          note:
            "PDF konnte nicht in Seitenbilder umgewandelt werden — als Datei " +
            "angehängt (Vision-Modell kann den Inhalt nicht lesen).",
        });
      } else {
        // best-effort: treat unknown as text
        try {
          files.push({ ...base, kind: "text", text: await file.text() });
        } catch {
          files.push({ ...base, note: "Dateityp nicht unterstützt." });
        }
      }
    } catch (e) {
      files.push({
        ...base,
        note: `Verarbeitung fehlgeschlagen: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });
    }
  }

  return NextResponse.json({ files });
}
