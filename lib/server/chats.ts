import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import type { Chat } from "@/lib/types";

/**
 * Per-user chat history, persisted server-side (in the /data volume) so a user
 * sees the same chats from any device. Mirrors the profiles store: one JSON
 * file per user, atomic write. Images/doc blobs are already stripped by the
 * client before saving (files live in the file store).
 */
export interface ChatsData {
  chats: Chat[];
  activeChatId: string | null;
}

const DIR = path.join(DATA_DIR, "chats");
const fileFor = (uid: string) => path.join(DIR, `${uid}.json`);
// Guard against a runaway payload (per user).
const MAX_JSON = 25_000_000;

export function getChats(userId: string): ChatsData {
  try {
    const d = JSON.parse(fs.readFileSync(fileFor(userId), "utf8")) as ChatsData;
    return { chats: Array.isArray(d.chats) ? d.chats : [], activeChatId: d.activeChatId ?? null };
  } catch {
    return { chats: [], activeChatId: null };
  }
}

export function setChats(userId: string, data: unknown): ChatsData {
  const src = (data && typeof data === "object" ? data : {}) as Partial<ChatsData>;
  const next: ChatsData = {
    chats: Array.isArray(src.chats) ? src.chats : [],
    activeChatId: typeof src.activeChatId === "string" ? src.activeChatId : null,
  };
  const json = JSON.stringify(next);
  if (json.length > MAX_JSON) throw new Error("Chat-Verlauf zu groß.");
  fs.mkdirSync(DIR, { recursive: true });
  const f = fileFor(userId);
  const tmp = `${f}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, json, "utf8");
    fs.renameSync(tmp, f);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
  return next;
}
