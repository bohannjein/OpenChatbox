import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import {
  saveFile,
  listFiles,
  deleteChatFiles,
  type FileKind,
  type FileSource,
} from "@/lib/server/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const stripPrefix = (u: string) => {
  const i = u.indexOf("base64,");
  return i >= 0 ? u.slice(i + 7) : u;
};
const mimeOf = (u: string) => /^data:([^;]+);/.exec(u)?.[1];

/** List the current user's persisted files (optionally scoped to one chat). */
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const chatId = req.nextUrl.searchParams.get("chatId") || undefined;
  return NextResponse.json({ files: listFiles(user.id, chatId) });
}

/**
 * Persist an uploaded/generated file. Accepts JSON built from the client-side
 * Attachment: { chatId, messageId, name, kind, source, mime?, dataUrl?, text? }.
 * Bytes come from the base64 dataUrl (binary) or the text content.
 */
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = typeof b.name === "string" && b.name ? b.name : "datei";
  const kind = (["image", "text", "code", "pdf", "other"] as const).includes(b.kind as FileKind)
    ? (b.kind as FileKind)
    : "other";
  const source: FileSource = b.source === "generated" ? "generated" : "upload";
  const dataUrl = typeof b.dataUrl === "string" ? b.dataUrl : undefined;
  const text = typeof b.text === "string" ? b.text : undefined;
  if (!dataUrl && text == null)
    return NextResponse.json({ error: "dataUrl oder text erforderlich." }, { status: 400 });

  const buf = dataUrl
    ? Buffer.from(stripPrefix(dataUrl), "base64")
    : Buffer.from(text ?? "", "utf8");
  if (buf.length > MAX_BYTES)
    return NextResponse.json({ error: "Datei zu groß." }, { status: 413 });

  const mime =
    (typeof b.mime === "string" && b.mime) ||
    (dataUrl && mimeOf(dataUrl)) ||
    (text != null ? "text/plain" : "application/octet-stream");

  const meta = saveFile(
    user.id,
    {
      chatId: String(b.chatId ?? ""),
      messageId: String(b.messageId ?? ""),
      name,
      kind,
      source,
      mime,
    },
    buf
  );
  return NextResponse.json({ file: meta });
}

/** Delete every file of a chat (called when the chat is deleted client-side). */
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId erforderlich." }, { status: 400 });
  return NextResponse.json({ deleted: deleteChatFiles(user.id, chatId) });
}
