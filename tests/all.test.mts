/**
 * Pure-logic test suite (no server/browser needed). Run: `npm test`.
 * Covers the routing/RAG/search helpers that are easy to regress.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { planPipeline, needsCurrentInfo, isImageGenRequest } from "../lib/autoPipeline";
import { detectCategory } from "../lib/modelRouter";
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

// ── officeParse: matrix table → per-cell facts ───────────────────────────
async function tableTests() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Filiale", "NAS", "Switch"],
    ["Hamburg", "10.0.0.5", "10.0.0.6"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Netz");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const text = await parseOffice(new File([buf], "f.xlsx"));
  ok("xlsx per-cell fact", text.includes("Hamburg — NAS: 10.0.0.5"));
  ok("xlsx no redundant row echo", !text.includes("Filiale: Hamburg | NAS:"));
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

await tableTests();
await kbTests();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
