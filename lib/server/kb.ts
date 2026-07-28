import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "./paths";

/**
 * Org-wide knowledge base (local RAG). A lightweight file-based vector store:
 * documents are chunked and embedded; chunks + embeddings live in a single
 * shared store at /data/kb/shared.json. Retrieval is an in-memory cosine search.
 *
 * Access is controlled per CATEGORY via a user ACL (see users.ts `kbCategories`):
 * each category is a permission the admin grants per user. The shared store holds
 * ALL categories; callers must pass the caller's allowed category ids so the
 * search/listing only ever sees permitted knowledge.
 *
 * Migration: earlier builds kept a PER-USER store at /data/kb/<uid>.json. On first
 * access we merge any such legacy files into shared.json (no data lost), then use
 * the shared store exclusively.
 */
export interface KbCategory {
  id: string;
  name: string;
  createdAt: number;
}
export interface KbDocument {
  id: string;
  categoryId: string;
  name: string;
  chunkCount: number;
  createdAt: number;
}
export interface KbChunk {
  id: string;
  docId: string;
  categoryId: string;
  docName: string;
  text: string;
  embedding: number[];
}
interface KbStore {
  categories: KbCategory[];
  documents: KbDocument[];
  chunks: KbChunk[];
}

const DIR = path.join(DATA_DIR, "kb");
const SHARED = path.join(DIR, "shared.json");

function emptyStore(): KbStore {
  return { categories: [], documents: [], chunks: [] };
}

function readStore(file: string): KbStore | null {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<KbStore>;
    return {
      categories: s.categories ?? [],
      documents: s.documents ?? [],
      chunks: s.chunks ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * One-time migration: fold every legacy per-user store (/data/kb/<uid>.json)
 * into the shared store. Idempotent — only runs while shared.json is absent.
 */
function migrateLegacy(): KbStore {
  const merged = emptyStore();
  try {
    if (!fs.existsSync(DIR)) return merged;
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith(".json") || f === "shared.json") continue;
      const legacy = readStore(path.join(DIR, f));
      if (!legacy) continue;
      merged.categories.push(...legacy.categories);
      merged.documents.push(...legacy.documents);
      merged.chunks.push(...legacy.chunks);
    }
  } catch {
    /* best-effort — a bad legacy file just isn't merged */
  }
  // De-dupe categories by id (UUIDs won't collide, but be safe).
  const seen = new Set<string>();
  merged.categories = merged.categories.filter((c) =>
    seen.has(c.id) ? false : (seen.add(c.id), true)
  );
  return merged;
}

function load(): KbStore {
  const existing = readStore(SHARED);
  if (existing) return existing;
  // No shared store yet → build it from any legacy per-user stores, then persist.
  const migrated = migrateLegacy();
  try {
    save(migrated);
  } catch {
    /* ignore — return in-memory even if the write fails */
  }
  return migrated;
}

function save(store: KbStore) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${SHARED}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
    fs.renameSync(tmp, SHARED);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** All category ids (used to resolve an admin's implicit all-access). */
export function allCategoryIds(): string[] {
  return load().categories.map((c) => c.id);
}

/** Public view (no embeddings). Optionally restricted to an allow-list. */
export function listKb(allowed?: string[]): {
  categories: KbCategory[];
  documents: KbDocument[];
} {
  const s = load();
  if (!allowed) return { categories: s.categories, documents: s.documents };
  const ok = new Set(allowed);
  return {
    categories: s.categories.filter((c) => ok.has(c.id)),
    documents: s.documents.filter((d) => ok.has(d.categoryId)),
  };
}

export function addCategory(name: string): KbCategory {
  const s = load();
  const cat: KbCategory = {
    id: randomUUID(),
    name: String(name || "Kategorie").slice(0, 100),
    createdAt: Date.now(),
  };
  s.categories.push(cat);
  save(s);
  return cat;
}

export function deleteCategory(id: string): boolean {
  const s = load();
  const before = s.categories.length;
  s.categories = s.categories.filter((c) => c.id !== id);
  s.documents = s.documents.filter((d) => d.categoryId !== id);
  s.chunks = s.chunks.filter((c) => c.categoryId !== id);
  if (s.categories.length === before) return false;
  save(s);
  return true;
}

export function deleteDocument(id: string): boolean {
  const s = load();
  const before = s.documents.length;
  s.documents = s.documents.filter((d) => d.id !== id);
  s.chunks = s.chunks.filter((c) => c.docId !== id);
  if (s.documents.length === before) return false;
  save(s);
  return true;
}

/**
 * Split text into overlapping chunks (~1000 chars). Line-aware: never cuts
 * through a line, so table rows / CSV rows / self-describing xlsx rows stay
 * intact. Overlap re-includes trailing lines; a single over-long line is hard
 * split as a fallback.
 */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const lines = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const chunks: string[] = [];
  let cur: string[] = [];
  let curLen = 0;
  const flush = () => {
    if (cur.length) chunks.push(cur.join("\n"));
  };

  for (const line of lines) {
    // Pathologically long single line → hard split (word-ish boundaries).
    if (line.length > size) {
      flush();
      cur = [];
      curLen = 0;
      for (let i = 0; i < line.length; i += size - overlap)
        chunks.push(line.slice(i, i + size));
      continue;
    }
    if (curLen + line.length + 1 > size && cur.length) {
      flush();
      // Keep trailing lines as overlap for context continuity.
      const keep: string[] = [];
      let kl = 0;
      for (let i = cur.length - 1; i >= 0 && kl < overlap; i--) {
        keep.unshift(cur[i]);
        kl += cur[i].length + 1;
      }
      cur = keep;
      curLen = kl;
    }
    cur.push(line);
    curLen += line.length + 1;
  }
  flush();
  return chunks;
}

/** Store a document's chunks + embeddings. embeddings[i] belongs to chunks[i]. */
export function addDocument(
  categoryId: string,
  name: string,
  chunks: string[],
  embeddings: number[][]
): KbDocument {
  const s = load();
  const docId = randomUUID();
  const doc: KbDocument = {
    id: docId,
    categoryId,
    name: String(name || "Dokument").slice(0, 200),
    chunkCount: chunks.length,
    createdAt: Date.now(),
  };
  s.documents.push(doc);
  chunks.forEach((text, idx) => {
    if (!embeddings[idx]) return;
    s.chunks.push({
      id: randomUUID(),
      docId,
      categoryId,
      docName: doc.name,
      text,
      // Quantize to ~5 decimals → roughly halves the stored size; cosine
      // similarity is unaffected in practice.
      embedding: embeddings[idx].map((v) => Math.round(v * 1e5) / 1e5),
    });
  });
  save(s);
  return doc;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export interface KbHit {
  docName: string;
  text: string;
  score: number;
}

/**
 * Top-k most similar chunks to the query embedding, restricted to `categoryIds`
 * (the caller's ACL — pass the empty result of an empty allow-list to get []).
 * Diversified across documents so one file can't monopolize the top-k.
 */
export function searchChunks(
  queryEmbedding: number[],
  k = 8,
  categoryIds?: string[],
  perDocCap = 3
): KbHit[] {
  if (!queryEmbedding.length) return [];
  // An explicit empty allow-list means "no access" → no results.
  if (categoryIds && categoryIds.length === 0) return [];
  const s = load();
  const pool =
    categoryIds && categoryIds.length
      ? s.chunks.filter((c) => categoryIds.includes(c.categoryId))
      : s.chunks;

  const scored = pool
    .map((c) => ({ docName: c.docName, text: c.text, score: cosine(queryEmbedding, c.embedding) }))
    .filter((h) => h.score > 0.2) // drop near-irrelevant matches
    .sort((a, b) => b.score - a.score);

  // First pass: spread across documents (respect the per-doc cap).
  const perDoc = new Map<string, number>();
  const primary: KbHit[] = [];
  const overflow: KbHit[] = [];
  for (const h of scored) {
    const n = perDoc.get(h.docName) ?? 0;
    if (n < perDocCap) {
      primary.push(h);
      perDoc.set(h.docName, n + 1);
    } else {
      overflow.push(h);
    }
  }
  // Diverse hits first, then fill remaining slots with the next best.
  return [...primary, ...overflow].slice(0, k);
}
