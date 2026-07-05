import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import type { GenParams, MemoryFact, PromptTemplate, Sidekick } from "@/lib/types";

/**
 * Per-user preferences, persisted server-side (keyed by user id) in the /data
 * volume — everything that used to live only in the browser's localStorage,
 * EXCEPT chats (still local for now) and the admin-global settings (config.ts).
 */
export interface UserProfile {
  theme?: string;
  lang?: "de" | "en" | null;
  params?: GenParams;
  customInstructions?: string;
  favorites?: string[];
  aliases?: Record<string, string>;
  codeSplitEnabled?: boolean;
  codeSplitThreshold?: number;
  codeSplitWidth?: number;
  chatLayout?: "classic" | "bubble";
  chatShowAvatar?: boolean;
  chatShowTimestamps?: boolean;
  chatShowStats?: boolean;
  assistantAvatarUrl?: string;
  chatBackgroundUrl?: string;
  memory?: MemoryFact[];
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  kbEnabled?: boolean;
  selectedModelKey?: string | null;
  autoRouter?: boolean;
  vramManaged?: boolean;
  ollamaKeepAlive?: string;
  sidekicks?: Sidekick[];
  prompts?: PromptTemplate[];
}

// Only these keys are accepted from a client patch (ignore anything else).
const KEYS: (keyof UserProfile)[] = [
  "theme",
  "lang",
  "params",
  "customInstructions",
  "favorites",
  "aliases",
  "codeSplitEnabled",
  "codeSplitThreshold",
  "codeSplitWidth",
  "chatLayout",
  "chatShowAvatar",
  "chatShowTimestamps",
  "chatShowStats",
  "assistantAvatarUrl",
  "chatBackgroundUrl",
  "memory",
  "memoryEnabled",
  "webSearchEnabled",
  "kbEnabled",
  "selectedModelKey",
  "autoRouter",
  "vramManaged",
  "ollamaKeepAlive",
  "sidekicks",
  "prompts",
];

const FILE = path.join(DATA_DIR, "profiles.json");
// Guard against a runaway payload bloating the file (per-user). Generous because
// the chat background + assistant avatar are stored as (resized) data URLs.
const MAX_JSON = 8_000_000;

function loadAll(): Record<string, UserProfile> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, UserProfile>;
  } catch {
    return {};
  }
}
function saveAll(map: Record<string, UserProfile>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

export function getProfile(userId: string): UserProfile {
  return loadAll()[userId] ?? {};
}

/** Merge a whitelisted patch into the user's profile and persist. */
export function setProfile(userId: string, patch: unknown): UserProfile {
  const src = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  const map = loadAll();
  const next: UserProfile = { ...(map[userId] ?? {}) };
  for (const k of KEYS) {
    if (k in src) (next as Record<string, unknown>)[k] = src[k];
  }
  // Reject an oversized profile rather than corrupting the store.
  if (JSON.stringify(next).length > MAX_JSON)
    throw new Error("Profil zu groß.");
  map[userId] = next;
  saveAll(map);
  return next;
}
