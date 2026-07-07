/**
 * Pure-logic test suite (no server/browser needed). Run: `npm test`.
 * Covers the routing/RAG/search helpers that are easy to regress.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { planPipeline, needsCurrentInfo, isImageGenRequest } from "../lib/autoPipeline";
import { detectCategory } from "../lib/modelRouter";
import { applyContextWindow } from "../lib/server/context";
import { parseOffice } from "../lib/server/officeParse";
import * as XLSX from "xlsx";
import type { ModelOption } from "../lib/types";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${extra}`}`);
};
const eq = (name: string, got: unknown, want: unknown) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)}`);

// ── autoPipeline: planPipeline ───────────────────────────────────────────
const cfg = { standardKey: "p::std", coding: "p::code", reasoning: "p::r", vision: "p::vl" };
const noOpts: ModelOption[] = [];
eq(
  "image → ocr chain",
  planPipeline(cfg, { hasImage: true, hasDoc: false, text: "x" }, noOpts).steps.map((s) => s.role),
  ["ocr", "answer"]
);
eq(
  "coding keyword → coding",
  planPipeline(cfg, { hasImage: false, hasDoc: false, text: "schreib ein python skript" }, noOpts)
    .steps[0].role,
  "coding"
);
eq(
  "plain text → text",
  planPipeline(cfg, { hasImage: false, hasDoc: false, text: "hallo" }, noOpts).steps[0].role,
  "text"
);
eq(
  "image-gen prompt → imagegen scenario",
  planPipeline(cfg, { hasImage: false, hasDoc: false, text: "generiere ein bild von einer katze" }, noOpts)
    .scenario,
  "imagegen"
);

// ── autoPipeline: intent helpers ─────────────────────────────────────────
ok("needsCurrentInfo: aktuell", needsCurrentInfo("was ist der aktuelle kurs"));
ok("needsCurrentInfo: static false", !needsCurrentInfo("erkläre rekursion"));
ok("isImageGenRequest: create", isImageGenRequest("male ein bild von einem hund", false));
ok("isImageGenRequest: with attachment false", !isImageGenRequest("beschreibe das bild", true));

// ── modelRouter: detectCategory ──────────────────────────────────────────
eq("detectCategory coding", detectCategory("debug diese funktion"), "coding");
eq("detectCategory reasoning", detectCategory("berechne die wahrscheinlichkeit"), "reasoning");
eq("detectCategory standard", detectCategory("wie geht es dir"), "standard");

// ── context: sliding window pins system, caps count, trims to token budget ─
{
  const sys = { role: "system", content: "SYS" };
  const seq = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `m${i}`,
  }));
  const w = applyContextWindow([sys, ...seq], { maxMessages: 20, maxTokens: 1_000_000 });
  eq(
    "ctx: system pinned + last-20 cap",
    [w.length, w[0].content, w[w.length - 1].content],
    [21, "SYS", "m29"]
  );

  const big = Array.from({ length: 6 }, (_, i) => ({
    role: "user",
    content: `big${i}-` + "x".repeat(4000), // ~1000 tokens each
  }));
  const w2 = applyContextWindow([sys, ...big], { maxMessages: 20, maxTokens: 500 });
  ok("ctx: system never dropped", w2[0].content === "SYS");
  ok("ctx: newest turn always kept", w2[w2.length - 1].content.startsWith("big5"));
  ok("ctx: old turns trimmed to budget", w2.length < big.length + 1);
}

// ── officeParse: matrix table → per-cell facts ───────────────────────────
async function tableTests() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Standort", "Gerät A", "Gerät B"],
    ["Standort-1", "192.0.2.5", "192.0.2.6"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Netz");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const text = await parseOffice(new File([buf], "f.xlsx"));
  ok("xlsx per-cell fact", text.includes("Standort-1 — Gerät A: 192.0.2.5"));
  ok("xlsx no redundant row echo", !text.includes("Standort: Standort-1 | Gerät A:"));
}

// ── kb: chunkText line-aware + searchChunks diversity (temp data dir) ─────
async function kbTests() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kbt-"));
  process.env.OPENCHATBOX_DATA_DIR = dir;
  const kb = await import("../lib/server/kb"); // import AFTER setting DATA_DIR

  const rows = Array.from({ length: 40 }, (_, i) => `Zeile ${i}: Wert ${i}`).join("\n");
  const chunks = kb.chunkText(rows, 200, 40);
  ok("chunkText: multiple chunks", chunks.length > 1);
  ok(
    "chunkText: rows never split",
    chunks.every((c) => c.split("\n").every((l) => /^Zeile \d+: Wert \d+$/.test(l)))
  );

  fs.mkdirSync(path.join(dir, "kb"), { recursive: true });
  const mk = (doc: string, emb: number[], i: number) => ({
    id: `${doc}-${i}`, docId: doc, categoryId: "c", docName: doc, text: `${doc} ${i}`, embedding: emb,
  });
  fs.writeFileSync(
    path.join(dir, "kb", "u1.json"),
    JSON.stringify({
      categories: [], documents: [],
      chunks: [
        ...Array.from({ length: 5 }, (_, i) => mk("A", [1, 0, 0], i)),
        ...Array.from({ length: 2 }, (_, i) => mk("B", [0.9, 0.1, 0], i)),
        mk("C", [0.85, 0.2, 0], 0),
      ],
    })
  );
  const hits = kb.searchChunks("u1", [1, 0, 0], 8, undefined, 3);
  const docs = new Set(hits.map((h) => h.docName));
  ok("searchChunks: spans multiple docs (diversified)", docs.size === 3);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── bookstack: secret encryption + write-permission tool filtering ────────
async function bookstackTests() {
  process.env.AUTH_SECRET = "test-secret-for-crypto-roundtrip";
  const { encryptSecret, decryptSecret, isEncrypted } = await import(
    "../lib/server/crypto"
  );
  const plain = "TokenId42:super-secret-value";
  const enc = encryptSecret(plain);
  ok("crypto: ciphertext hides plaintext", enc !== plain && isEncrypted(enc));
  eq("crypto: decrypt round-trip", decryptSecret(enc), plain);
  eq("crypto: legacy plaintext passthrough", decryptSecret("legacy-plain"), "legacy-plain");

  const { toolDefs, wildcardQuery } = await import("../lib/server/bookstack");
  eq(
    "bookstack wildcard: long words get *",
    wildcardQuery("alufwerk sasdir"),
    "alufwerk* sasdir*"
  );
  eq(
    "bookstack wildcard: <3 dropped, ≤4 keeps no star",
    wildcardQuery("die cd rom laufwerk"),
    "die rom laufwerk*"
  );
  const read = toolDefs(false).map((t) => t.name);
  const write = toolDefs(true).map((t) => t.name);
  const destructive = [
    "bookstack_create_page",
    "bookstack_update_page",
    "bookstack_delete_page",
  ];
  ok(
    "bookstack: read-only mode hides all write tools",
    destructive.every((n) => !read.includes(n))
  );
  ok(
    "bookstack: write mode exposes create/update/delete",
    destructive.every((n) => write.includes(n))
  );
  ok(
    "bookstack: search available in both modes",
    read.includes("bookstack_search") && write.includes("bookstack_search")
  );
}

await tableTests();
await kbTests();
await bookstackTests();

// ── spellfix: proper-noun fuzzy correction ───────────────────────────────
{
  const { damerauLevenshtein, correctProperNouns } = await import(
    "../lib/server/spellfix"
  );
  eq("damerau: transposition = 1", damerauLevenshtein("ipsa", "ispa"), 1);
  eq("damerau: substitution = 1", damerauLevenshtein("hab", "hub"), 1);
  eq("damerau: identical = 0", damerauLevenshtein("ispa", "ispa"), 0);

  const dict = ["ispa hub"];
  eq(
    "properNoun: transposition+sub → canonical",
    correctProperNouns("wie öffne ich ipsa hab", dict).corrected,
    "wie öffne ich ispa hub"
  );
  eq(
    "properNoun: single sub → canonical",
    correctProperNouns("ispa hab login", dict).corrected,
    "ispa hub login"
  );
  eq(
    "properNoun: transposition → canonical",
    correctProperNouns("ipsa hub status", dict).corrected,
    "ispa hub status"
  );
  ok(
    "properNoun: exact match → no replacement",
    correctProperNouns("ispa hub", dict).replacements.length === 0
  );
  eq(
    "properNoun: unrelated query untouched",
    correctProperNouns("docker setup anleitung", dict).corrected,
    "docker setup anleitung"
  );
  ok(
    "properNoun: empty dictionary is a no-op",
    correctProperNouns("ipsa hab", []).corrected === "ipsa hab"
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
