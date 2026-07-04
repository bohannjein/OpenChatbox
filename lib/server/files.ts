import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "./paths";

/**
 * Persistent, global file store. Physical bytes live on disk under
 * DATA_DIR/files/<ownerId>/<id><ext>; metadata lives in files.json. Files are
 * owned by a user and tagged with the chat they belong to, so they stay visible
 * cross-chat in the file manager until the chat is deleted.
 */
export type FileKind = "image" | "text" | "code" | "pdf" | "other";
export type FileSource = "upload" | "generated";

export interface FileMeta {
  id: string;
  ownerId: string;
  chatId: string;
  /** message the file was uploaded with / generated under (for jumpback) */
  messageId: string;
  name: string;
  kind: FileKind;
  source: FileSource;
  mime: string;
  size: number;
  /** stored extension (leading dot), used to build the on-disk path */
  ext: string;
  createdAt: number;
}

const FILE = path.join(DATA_DIR, "files.json");
const FILES_DIR = path.join(DATA_DIR, "files");

function loadAll(): { files: FileMeta[] } {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as { files: FileMeta[] };
  } catch {
    return { files: [] };
  }
}
function saveAll(data: { files: FileMeta[] }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

/** Absolute on-disk path for a file's bytes. */
function diskPath(ownerId: string, id: string, ext: string): string {
  return path.join(FILES_DIR, ownerId, `${id}${ext}`);
}

/** Normalize a filename extension to a safe ".xyz" (or ""). */
function safeExt(name: string): string {
  const e = path.extname(name || "").toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(e) ? e : "";
}

export interface SaveFileInput {
  chatId: string;
  messageId: string;
  name: string;
  kind: FileKind;
  source: FileSource;
  mime: string;
}

/** Persist bytes + register metadata. Returns the stored FileMeta. */
export function saveFile(ownerId: string, input: SaveFileInput, buf: Buffer): FileMeta {
  const id = randomUUID();
  const ext = safeExt(input.name);
  const dir = path.join(FILES_DIR, ownerId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(diskPath(ownerId, id, ext), buf);
  const meta: FileMeta = {
    id,
    ownerId,
    chatId: String(input.chatId || ""),
    messageId: String(input.messageId || ""),
    name: input.name || `datei${ext}`,
    kind: input.kind,
    source: input.source,
    mime: input.mime || "application/octet-stream",
    size: buf.length,
    ext,
    createdAt: Date.now(),
  };
  const data = loadAll();
  data.files.push(meta);
  saveAll(data);
  return meta;
}

/** List a user's files, newest first; optionally scoped to one chat. */
export function listFiles(ownerId: string, chatId?: string): FileMeta[] {
  return loadAll()
    .files.filter((f) => f.ownerId === ownerId && (!chatId || f.chatId === chatId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Resolve a file's metadata + absolute path, enforcing ownership. */
export function getFile(ownerId: string, id: string): { meta: FileMeta; path: string } | null {
  const meta = loadAll().files.find((f) => f.id === id && f.ownerId === ownerId);
  if (!meta) return null;
  return { meta, path: diskPath(ownerId, id, meta.ext) };
}

/** Delete one file (bytes + metadata). Returns true if it existed. */
export function deleteFile(ownerId: string, id: string): boolean {
  const data = loadAll();
  const meta = data.files.find((f) => f.id === id && f.ownerId === ownerId);
  if (!meta) return false;
  try {
    fs.rmSync(diskPath(ownerId, id, meta.ext), { force: true });
  } catch {
    /* best-effort */
  }
  data.files = data.files.filter((f) => !(f.id === id && f.ownerId === ownerId));
  saveAll(data);
  return true;
}

/** Delete every file belonging to a chat (called when the chat is deleted). */
export function deleteChatFiles(ownerId: string, chatId: string): number {
  const data = loadAll();
  const victims = data.files.filter((f) => f.ownerId === ownerId && f.chatId === chatId);
  for (const m of victims) {
    try {
      fs.rmSync(diskPath(ownerId, m.id, m.ext), { force: true });
    } catch {
      /* best-effort */
    }
  }
  data.files = data.files.filter((f) => !(f.ownerId === ownerId && f.chatId === chatId));
  if (victims.length) saveAll(data);
  return victims.length;
}
