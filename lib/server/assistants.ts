import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

/**
 * Embedded assistants: the identity behind the public API. An assistant is NOT a
 * user — no record in users.json, no role, no session cookie. That is the point:
 * every `getUser`-guarded route rejects it by construction, so an integration
 * can never reach chats, profiles or the admin API. What it may do is defined
 * here and nowhere else — one pinned model, an explicit set of knowledge
 * categories and wiki books, and hard limits.
 */

const FILE = path.join(DATA_DIR, "assistants.json");

export type KeyKind = "secret" | "public";

export interface AssistantKey {
  id: string;
  kind: KeyKind;
  /** sha256 of the key — the key itself is shown once at creation and never stored. */
  hash: string;
  /** last 4 characters, so the admin can tell two keys apart in the list. */
  last4: string;
  createdAt: number;
  lastUsedAt: number;
  revokedAt?: number;
  label: string;
}

export interface AssistantLimits {
  /** requests per minute across all callers of this assistant */
  perMinute: number;
  /** requests per day from one IP */
  perDayPerIp: number;
  /** requests per day for the whole assistant */
  perDay: number;
  /** characters accepted in the incoming messages */
  maxInputChars: number;
  /** conversation turns kept (the caller sends the history) */
  maxHistory: number;
}

export interface AssistantUsage {
  requests: number;
  /** requests rejected by a limit */
  denied: number;
  inChars: number;
  outChars: number;
  lastUsedAt: number;
  /** YYYY-MM-DD of dayRequests */
  day: string;
  dayRequests: number;
}

export interface Assistant {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  /** "providerId::model" — enforced server-side; callers cannot choose. */
  modelKey: string;
  systemPrompt: string;
  /** First line the widget shows before the visitor types anything. */
  greeting: string;
  temperature?: number;
  maxTokens?: number;
  /** Local KB categories. [] = no document access (searchChunks is default-deny). */
  kbCategoryIds: string[];
  /** Wiki access. [] books = off; never means "the whole instance". */
  bookstack: { enabled: boolean; bookIds: number[] };
  webSearch: boolean;
  /** Append the source list to the answer. */
  showSources: boolean;
  limits: AssistantLimits;
  /** Exact origins the public (widget) key may be used from. */
  allowedOrigins: string[];
  /** Counters only — no message content is ever stored. */
  usage: AssistantUsage;
  keys: AssistantKey[];
}

export const DEFAULT_LIMITS: AssistantLimits = {
  perMinute: 20,
  perDayPerIp: 100,
  perDay: 1000,
  maxInputChars: 8000,
  maxHistory: 10,
};

const today = () => new Date().toISOString().slice(0, 10);

function load(): Assistant[] {
  try {
    const arr = JSON.parse(fs.readFileSync(FILE, "utf8")).assistants as Assistant[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(assistants: Assistant[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify({ assistants }, null, 2), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function listAssistants(): Assistant[] {
  return load();
}

export function getAssistant(id: string): Assistant | null {
  return load().find((a) => a.id === id) ?? null;
}

const str = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Normalize an origin to scheme://host[:port] — anything else is dropped. */
export function normalizeOrigin(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

/** Create or update an assistant. Keys and usage are never touched here. */
export function upsertAssistant(input: Record<string, unknown>): Assistant {
  const all = load();
  const existing = typeof input.id === "string" ? all.find((a) => a.id === input.id) : undefined;
  const prev: Assistant | undefined = existing;

  const bs = (input.bookstack ?? {}) as { enabled?: unknown; bookIds?: unknown };
  const lim = (input.limits ?? {}) as Record<string, unknown>;

  const next: Assistant = {
    id: prev?.id ?? crypto.randomUUID(),
    createdAt: prev?.createdAt ?? Date.now(),
    name: str(input.name, 80, prev?.name ?? "Neuer Assistent") || "Neuer Assistent",
    enabled: input.enabled === undefined ? (prev?.enabled ?? false) : !!input.enabled,
    modelKey: str(input.modelKey, 200, prev?.modelKey ?? ""),
    systemPrompt: str(input.systemPrompt, 8000, prev?.systemPrompt ?? ""),
    greeting: str(input.greeting, 300, prev?.greeting ?? ""),
    temperature:
      input.temperature === undefined || input.temperature === null
        ? prev?.temperature
        : int(Number(input.temperature) * 100, 0, 200, 20) / 100,
    maxTokens:
      input.maxTokens === undefined || input.maxTokens === null
        ? prev?.maxTokens
        : int(input.maxTokens, 64, 8192, 1024),
    kbCategoryIds: Array.isArray(input.kbCategoryIds)
      ? (input.kbCategoryIds as unknown[])
          .filter((s): s is string => typeof s === "string")
          .slice(0, 200)
      : prev?.kbCategoryIds ?? [],
    bookstack: {
      enabled: bs.enabled === undefined ? !!prev?.bookstack?.enabled : !!bs.enabled,
      bookIds: Array.isArray(bs.bookIds)
        ? (bs.bookIds as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n > 0)
            .slice(0, 200)
        : prev?.bookstack?.bookIds ?? [],
    },
    webSearch: input.webSearch === undefined ? !!prev?.webSearch : !!input.webSearch,
    showSources:
      input.showSources === undefined ? prev?.showSources ?? true : !!input.showSources,
    limits: {
      perMinute: int(lim.perMinute, 1, 600, prev?.limits.perMinute ?? DEFAULT_LIMITS.perMinute),
      perDayPerIp: int(
        lim.perDayPerIp,
        1,
        100_000,
        prev?.limits.perDayPerIp ?? DEFAULT_LIMITS.perDayPerIp
      ),
      perDay: int(lim.perDay, 1, 1_000_000, prev?.limits.perDay ?? DEFAULT_LIMITS.perDay),
      maxInputChars: int(
        lim.maxInputChars,
        200,
        200_000,
        prev?.limits.maxInputChars ?? DEFAULT_LIMITS.maxInputChars
      ),
      maxHistory: int(lim.maxHistory, 1, 40, prev?.limits.maxHistory ?? DEFAULT_LIMITS.maxHistory),
    },
    allowedOrigins: Array.isArray(input.allowedOrigins)
      ? Array.from(
          new Set((input.allowedOrigins as unknown[]).map(normalizeOrigin).filter(Boolean))
        ).slice(0, 50)
      : prev?.allowedOrigins ?? [],
    usage:
      prev?.usage ??
      { requests: 0, denied: 0, inChars: 0, outChars: 0, lastUsedAt: 0, day: today(), dayRequests: 0 },
    keys: prev?.keys ?? [],
  };

  if (prev) all[all.indexOf(prev)] = next;
  else all.push(next);
  save(all);
  return next;
}

export function deleteAssistant(id: string): boolean {
  const all = load();
  if (!all.some((a) => a.id === id)) return false;
  save(all.filter((a) => a.id !== id));
  return true;
}

const PREFIX: Record<KeyKind, string> = { secret: "ocb_sk_", public: "ocb_pk_" };

export const hashKey = (key: string) =>
  crypto.createHash("sha256").update(key, "utf8").digest("hex");

/**
 * Mint a key. Only the hash is persisted, so the plaintext returned here is the
 * only copy that will ever exist — the admin UI shows it once. Deliberately
 * different from encryptSecret (SMTP/OIDC), which has to decrypt to use the
 * secret; an API key only ever needs to be compared.
 */
export function createKey(
  assistantId: string,
  kind: KeyKind,
  label = ""
): { assistant: Assistant; key: string } | null {
  const all = load();
  const a = all.find((x) => x.id === assistantId);
  if (!a) return null;
  const key = PREFIX[kind] + crypto.randomBytes(24).toString("base64url");
  a.keys.push({
    id: crypto.randomUUID(),
    kind,
    hash: hashKey(key),
    last4: key.slice(-4),
    createdAt: Date.now(),
    lastUsedAt: 0,
    label: str(label, 60),
  });
  save(all);
  return { assistant: a, key };
}

export function revokeKey(assistantId: string, keyId: string): boolean {
  const all = load();
  const a = all.find((x) => x.id === assistantId);
  const k = a?.keys.find((x) => x.id === keyId);
  if (!a || !k || k.revokedAt) return false;
  k.revokedAt = Date.now();
  save(all);
  return true;
}

/**
 * Resolve a presented key. Compares hashes with timingSafeEqual, skips revoked
 * keys, and ignores disabled assistants. Linear scan — the same approach as
 * workspace invites, and the list is tiny.
 */
export function findByKey(presented: string): { assistant: Assistant; key: AssistantKey } | null {
  const p = presented.trim();
  if (!p.startsWith("ocb_")) return null;
  const want = Buffer.from(hashKey(p), "hex");
  for (const a of load()) {
    if (!a.enabled) continue;
    for (const k of a.keys) {
      if (k.revokedAt) continue;
      const got = Buffer.from(k.hash, "hex");
      if (got.length === want.length && crypto.timingSafeEqual(got, want))
        return { assistant: a, key: k };
    }
  }
  return null;
}

/** Counters only — never message content. Rolls the daily bucket over at midnight. */
export function bumpUsage(
  assistantId: string,
  patch: { requests?: number; denied?: number; inChars?: number; outChars?: number; keyId?: string }
): void {
  const all = load();
  const a = all.find((x) => x.id === assistantId);
  if (!a) return;
  const now = Date.now();
  const d = today();
  if (a.usage.day !== d) {
    a.usage.day = d;
    a.usage.dayRequests = 0;
  }
  a.usage.requests += patch.requests ?? 0;
  a.usage.dayRequests += patch.requests ?? 0;
  a.usage.denied += patch.denied ?? 0;
  a.usage.inChars += patch.inChars ?? 0;
  a.usage.outChars += patch.outChars ?? 0;
  a.usage.lastUsedAt = now;
  if (patch.keyId) {
    const k = a.keys.find((x) => x.id === patch.keyId);
    if (k) k.lastUsedAt = now;
  }
  save(all);
}

/** Requests already used today, with the daily bucket rolled over if stale. */
export function dayRequests(a: Assistant): number {
  return a.usage.day === today() ? a.usage.dayRequests : 0;
}

/** Admin view: key hashes stripped, so a leaked admin response reveals nothing. */
export function publicAssistant(a: Assistant) {
  return {
    ...a,
    keys: a.keys.map(({ hash, ...rest }) => {
      void hash;
      return rest;
    }),
  };
}
