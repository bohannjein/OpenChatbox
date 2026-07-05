import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "./paths";

/**
 * Per-user knowledge base (local RAG). A lightweight file-based vector store:
 * documents are chunked and embedded, chunks + embeddings live in
 * /data/kb/<uid>.json, and retrieval is an in-memory cosine search on load.
 * No external vector DB — keeps the /data volume self-contained.
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
const fileFor = (uid: string) => path.join(DIR, `${uid}.json`);

function load(uid: string): KbStore {
  try {
    return JSON.parse(fs.readFileSync(fileFor(uid), "utf8")) as KbStore;
  } catch {
    return { categories: [], documents: [], chunks: [] };
  }
}
function save(uid: string, store: KbStore) {
  fs.mkdirSync(DIR, { recursive: true });
  const f = fileFor(uid);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
  fs.renameSync(tmp, f);
}

/** Public view (no embeddings) for the management UI. */
export function listKb(uid: string): { categories: KbCategory[]; documents: KbDocument[] } {
  const s = load(uid);
  return { categories: s.categories, documents: s.documents };
}

export function addCategory(uid: string, name: string): KbCategory {
  const s = load(uid);
  const cat: KbCategory = {
    id: randomUUID(),
    name: String(name || "Kategorie").slice(0, 100),
    createdAt: Date.now(),
  };
  s.categories.push(cat);
  save(uid, s);
  return cat;
}

export function deleteCategory(uid: string, id: string): boolean {
  const s = load(uid);
  const before = s.categories.length;
  s.categories = s.categories.filter((c) => c.id !== id);
  s.documents = s.documents.filter((d) => d.categoryId !== id);
  s.chunks = s.chunks.filter((c) => c.categoryId !== id);
  if (s.categories.length === before) return false;
  save(uid, s);
  return true;
}

export function deleteDocument(uid: string, id: string): boolean {
  const s = load(uid);
  const before = s.documents.length;
  s.documents = s.documents.filter((d) => d.id !== id);
  s.chunks = s.chunks.filter((c) => c.docId !== id);
  if (s.documents.length === before) return false;
  save(uid, s);
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
  uid: string,
  categoryId: string,
  name: string,
  chunks: string[],
  embeddings: number[][]
): KbDocument {
  const s = load(uid);
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
      embedding: embeddings[idx],
    });
  });
  save(uid, s);
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
 * Top-k most similar chunks to the query embedding. Diversified across
 * documents: a single file can supply at most `perDocCap` chunks in the first
 * pass, so relevant passages from OTHER documents surface too instead of one
 * file monopolizing the whole top-k. Remaining slots are then filled with the
 * next-best chunks regardless of document.
 */
export function searchChunks(
  uid: string,
  queryEmbedding: number[],
  k = 8,
  categoryIds?: string[],
  perDocCap = 3
): KbHit[] {
  if (!queryEmbedding.length) return [];
  const s = load(uid);
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
