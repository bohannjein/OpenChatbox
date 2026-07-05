import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import type { Chat } from "@/lib/types";

/**
 * Chat persistence in the /data volume.
 *  - Personal chats (no workspace / the default personal workspace) live in a
 *    per-user file: chats/<uid>.json. Replaced wholesale on save.
 *  - Workspace chats live in a per-WORKSPACE file: chats/ws/<wsId>.json, shared
 *    by all members. Saved by MERGE (union by id, newest updatedAt wins) so
 *    concurrent members never clobber each other's chats.
 * A user's view = their personal chats + every chat of the workspaces they are
 * a member of. Membership is enforced by the API route.
 */
export interface ChatsData {
  chats: Chat[];
  activeChatId: string | null;
}

const DEFAULT_WS = "ws-default";
const DIR = path.join(DATA_DIR, "chats");
const WS_DIR = path.join(DIR, "ws");
const MAX_JSON = 25_000_000;

const validId = (id: string) => /^[\w-]+$/.test(id);
const isPersonal = (c: Chat) => !c.workspaceId || c.workspaceId === DEFAULT_WS;

function atomicWrite(file: string, json: string) {
  if (json.length > MAX_JSON) throw new Error("Chat-Verlauf zu groß.");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, json, "utf8");
    fs.renameSync(tmp, file);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
}

function readUser(uid: string): ChatsData {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, `${uid}.json`), "utf8")) as ChatsData;
    return { chats: Array.isArray(d.chats) ? d.chats : [], activeChatId: d.activeChatId ?? null };
  } catch {
    return { chats: [], activeChatId: null };
  }
}
function readWs(wsId: string): Chat[] {
  if (!validId(wsId)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(path.join(WS_DIR, `${wsId}.json`), "utf8")) as {
      chats?: Chat[];
    };
    return Array.isArray(d.chats) ? d.chats : [];
  } catch {
    return [];
  }
}

/** Union two chat lists by id; for a shared id keep the newer updatedAt. */
function mergeById(base: Chat[], incoming: Chat[]): Chat[] {
  const map = new Map<string, Chat>();
  for (const c of base) map.set(c.id, c);
  for (const c of incoming) {
    const prev = map.get(c.id);
    if (!prev || (c.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) map.set(c.id, c);
  }
  return [...map.values()];
}

/** A user's full view: personal chats + all member-workspace chats. */
export function getChatsForUser(userId: string, memberWsIds: string[]): ChatsData {
  const personal = readUser(userId);
  const shared = memberWsIds
    .filter((id) => id && id !== DEFAULT_WS)
    .flatMap((id) => readWs(id));
  return { chats: [...personal.chats, ...shared], activeChatId: personal.activeChatId };
}

/** Persist: personal chats → user file (replace); workspace chats → per-ws file
 *  (merged), only for workspaces the user is a member of. */
export function setChatsForUser(
  userId: string,
  memberWsIds: string[],
  data: unknown
): void {
  const src = (data && typeof data === "object" ? data : {}) as Partial<ChatsData>;
  const incoming = Array.isArray(src.chats) ? src.chats : [];
  const activeChatId = typeof src.activeChatId === "string" ? src.activeChatId : null;

  // Personal file: only personal chats + the active id.
  atomicWrite(
    path.join(DIR, `${userId}.json`),
    JSON.stringify({ chats: incoming.filter(isPersonal), activeChatId })
  );

  // Group the workspace chats by workspace (members only).
  const memberSet = new Set(memberWsIds);
  const byWs = new Map<string, Chat[]>();
  for (const c of incoming) {
    const w = c.workspaceId;
    if (!w || w === DEFAULT_WS || !validId(w) || !memberSet.has(w)) continue;
    const arr = byWs.get(w) ?? [];
    arr.push(c);
    byWs.set(w, arr);
  }
  for (const [w, chats] of byWs) {
    const merged = mergeById(readWs(w), chats);
    atomicWrite(path.join(WS_DIR, `${w}.json`), JSON.stringify({ chats: merged }));
  }
}
