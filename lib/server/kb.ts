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

/** Split text into overlapping chunks (~1000 chars, break on whitespace). */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const ws = clean.lastIndexOf(" ", end);
      if (ws > i + size * 0.6) end = ws; // prefer a word boundary
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
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

/** Top-k most similar chunks to the query embedding (optionally by category). */
export function searchChunks(
  uid: string,
  queryEmbedding: number[],
  k = 5,
  categoryIds?: string[]
): KbHit[] {
  if (!queryEmbedding.length) return [];
  const s = load(uid);
  const pool =
    categoryIds && categoryIds.length
      ? s.chunks.filter((c) => categoryIds.includes(c.categoryId))
      : s.chunks;
  return pool
    .map((c) => ({ docName: c.docName, text: c.text, score: cosine(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter((h) => h.score > 0.2); // drop near-irrelevant matches
}
