import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getUser } from "@/lib/server/adminAuth";
import { getFile, deleteFile } from "@/lib/server/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download a persisted file's bytes (ownership enforced). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const found = getFile(user.id, id);
  if (!found || !fs.existsSync(found.path))
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  const buf = fs.readFileSync(found.path);
  const disposition = req.nextUrl.searchParams.get("dl") === "0" ? "inline" : "attachment";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": found.meta.mime || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(found.meta.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Delete a single persisted file. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ deleted: deleteFile(user.id, id) });
}
