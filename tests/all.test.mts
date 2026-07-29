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
  // Legacy per-user file (kb/u1.json) is auto-migrated into the shared store on
  // first load; the new signature drops the uid.
  const hits = kb.searchChunks([1, 0, 0], 8, undefined, 3);
  const docs = new Set(hits.map((h) => h.docName));
  ok("searchChunks: spans multiple docs (diversified) + legacy migration", docs.size === 3);
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

// ── KB access control (ACL) ──────────────────────────────────────────────
{
  const { allowedCategoryIds, canManageKb } = await import("../lib/server/users");
  const all = ["a", "b", "c"];
  eq(
    "acl: admin sees all categories",
    allowedCategoryIds({ role: "admin" }, all),
    all
  );
  eq(
    "acl: user limited to granted ∩ existing",
    allowedCategoryIds({ role: "user", kbCategories: ["b", "x"] }, all),
    ["b"]
  );
  eq(
    "acl: user with no grants sees nothing",
    allowedCategoryIds({ role: "user", kbCategories: [] }, all),
    []
  );
  ok("acl: admin can manage KB", canManageKb({ role: "admin" }));
  ok("acl: poweruser can manage KB", canManageKb({ role: "poweruser" }));
  ok("acl: user cannot manage KB", !canManageKb({ role: "user" }));

  const { searchChunks } = await import("../lib/server/kb");
  ok(
    "kb: empty allow-list yields no results (default-deny)",
    searchChunks([0.1, 0.2], 8, []).length === 0
  );
}

// ── preview helpers (HTML/SVG artifacts) ─────────────────────────────────
{
  const { isSvgCode, isPreviewable, buildPreviewDoc } = await import("../lib/preview");
  ok("preview: detects svg by lang", isSvgCode("<svg></svg>", "svg"));
  ok("preview: detects svg by content", isSvgCode('<svg viewBox="0 0 1 1"><rect/></svg>'));
  ok("preview: js is not svg", !isSvgCode("const x = 1;", "js"));
  ok("preview: html fragment is previewable", isPreviewable('<div class="p-4">Hi</div>', "html"));
  ok("preview: tailwind fragment previewable", isPreviewable('<button class="bg-blue-500 rounded">x</button>'));
  ok("preview: plain JS not previewable", !isPreviewable("function f(){return 1}", "js"));
  ok(
    "preview: full document passed through verbatim",
    buildPreviewDoc("<html><body>hi</body></html>", "html").includes("<html>") &&
      !buildPreviewDoc("<html><body>hi</body></html>", "html").includes("cdn.tailwindcss.com")
  );
  ok(
    "preview: tailwind fragment gets the play CDN",
    buildPreviewDoc('<div class="flex gap-2">x</div>', "html").includes("cdn.tailwindcss.com")
  );
  ok(
    "preview: svg centered on a canvas wrapper",
    buildPreviewDoc("<svg></svg>", "svg").includes("<svg></svg>")
  );
}

// ── authMethods: sign-in method policy in publicConfig ───────────────────
{
  // Import AFTER the kb test so paths.ts (loaded by that test's dynamic kb
  // import) has already bound DATA_DIR — a static top-level import here would
  // load paths.ts too early and break the kb test's temp-dir setup.
  const { publicConfig } = await import("../lib/server/config");
  // Defaults: both methods on when nothing is configured (backward compat).
  const def = publicConfig({ appName: "x" });
  ok("authMethods: password defaults on", def.authMethods.password === true);
  ok("authMethods: sso defaults on", def.authMethods.sso === true);

  // Explicit off is honored.
  const off = publicConfig({
    appName: "x",
    authMethods: { password: { enabled: false }, sso: { enabled: false } },
  });
  ok("authMethods: password off honored", off.authMethods.password === false);
  ok("authMethods: sso off honored", off.authMethods.sso === false);

  // SSO button stays off without OIDC env even when the method is enabled
  // (no OIDC env in the test process → oidcConfig() is null).
  ok("authMethods: sso button off without env", def.sso.enabled === false);
  ok("authMethods: sso not configured in test env", def.sso.configured === false);
}

// ── branding: sanitize / resolve / publicConfig / no hardcoded product name ──
{
  const { sanitizeBranding, resolveBranding, DEFAULT_ACCENT, DEFAULT_APP_NAME } = await import(
    "../lib/branding"
  );
  const { publicConfig } = await import("../lib/server/config");

  // sanitizeBranding is the only guard in front of config.json — it must drop,
  // not store, anything that isn't a plain color / http(s) URL / image data URL.
  const bad = sanitizeBranding({
    appName: "   ",
    accentColor: "javascript:alert(1)",
    imprintUrl: "javascript:alert(1)",
    privacyUrl: "file:///etc/passwd",
    supportEmail: "not-an-email",
    supportUrl: "  ",
    logoUrl: "data:text/html;base64,PHNjcmlwdD4=",
    faviconUrl: "data:image/png;base64,AAA",
    appUrl: "https://chat.firma.de/",
  });
  eq("branding: empty name → default", bad.appName, DEFAULT_APP_NAME);
  eq("branding: bad hex → default accent", bad.accentColor, DEFAULT_ACCENT);
  eq("branding: javascript: imprint dropped", bad.imprintUrl, "");
  eq("branding: file: privacy dropped", bad.privacyUrl, "");
  eq("branding: invalid email dropped", bad.supportEmail, "");
  eq("branding: text/html data URL dropped", bad.logoUrl, "");
  eq("branding: image data URL kept", bad.faviconUrl, "data:image/png;base64,AAA");
  eq("branding: appUrl trailing slash stripped", bad.appUrl, "https://chat.firma.de");

  const big = sanitizeBranding({ logoUrl: "data:image/png;base64," + "A".repeat(500_001) });
  eq("branding: oversized asset dropped", big.logoUrl, "");

  const okBrand = sanitizeBranding({ accentColor: "#AABBCC", appName: "  Musterfirma  Chat " });
  eq("branding: hex normalized to lowercase", okBrand.accentColor, "#aabbcc");
  eq("branding: name trimmed + collapsed", okBrand.appName, "Musterfirma Chat");

  // A config.json written before the brand layer only has the flat fields.
  const legacy = resolveBranding({ appName: "Alt AG", accentColor: "#123456", logoUrl: "" });
  eq("branding: legacy flat appName read", legacy.appName, "Alt AG");
  eq("branding: legacy flat accent read", legacy.accentColor, "#123456");
  // Nested wins over the flat mirror.
  const both = resolveBranding({ appName: "Alt AG", branding: { appName: "Neu GmbH" } });
  eq("branding: nested beats legacy", both.appName, "Neu GmbH");

  const pub = publicConfig({ appName: "x", branding: sanitizeBranding({ appName: "Firma" }) });
  eq("branding: publicConfig exposes branding", pub.branding.appName, "Firma");
  eq("branding: publicConfig mirrors appName", pub.appName, "Firma");

  // Guard: the product name must not creep back into the UI as a literal. Every
  // surface reads getBranding()/useBrand(); these files are the only places the
  // fallback name may appear.
  const ALLOWED = new Set([
    path.join("lib", "branding.ts"), // DEFAULT_APP_NAME itself
    path.join("lib", "version.ts"), // repository name/URL
    path.join("lib", "store.ts"), // localStorage persist key
    path.join("app", "layout.tsx"), // pre-hydration script reads that key
    path.join("app", "share", "page.tsx"), // same key, read directly
  ]);
  const walk = (dir: string, hits: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, hits);
      else if (/\.tsx?$/.test(e.name)) {
        const rel = path.relative(process.cwd(), p);
        if (!ALLOWED.has(rel) && fs.readFileSync(p, "utf8").includes("OpenChatbox")) hits.push(rel);
      }
    }
    return hits;
  };
  const leaks = [...walk("app"), ...walk("components"), ...walk("lib")];
  ok("branding: no hardcoded product name in UI code", leaks.length === 0, leaks.join(", "));
}

// ── providerStream: request shapes + stream normalization ────────────────
{
  const { buildProviderRequest, streamProvider, normalizeKeepAlive, tokenBudgetFor, NUM_CTX } =
    await import("../lib/server/providerStream");

  const msgs = [
    { role: "system", content: "sys" },
    { role: "user", content: "hi", images: ["data:image/png;base64,AAA"] },
  ];
  const base = { baseUrl: "http://h", model: "m", messages: msgs, maxTokens: 100 };

  const oll = buildProviderRequest({ ...base, type: "ollama", keepAlive: -1 });
  const ollBody = JSON.parse(String(oll.init.body));
  eq("providerStream: ollama url", oll.url, "http://h/api/chat");
  eq("providerStream: ollama strips data-URL prefix", ollBody.messages[1].images, ["AAA"]);
  eq("providerStream: ollama num_ctx", ollBody.options.num_ctx, NUM_CTX);
  eq("providerStream: ollama num_predict from maxTokens", ollBody.options.num_predict, 100);
  eq("providerStream: ollama keep_alive numeric", ollBody.keep_alive, -1);

  const ant = buildProviderRequest({ ...base, type: "anthropic", apiKey: "k" });
  const antBody = JSON.parse(String(ant.init.body));
  eq("providerStream: anthropic url", ant.url, "http://h/messages");
  eq("providerStream: anthropic system hoisted", antBody.system, "sys");
  eq("providerStream: anthropic drops system from messages", antBody.messages.length, 1);
  eq(
    "providerStream: anthropic image part",
    antBody.messages[0].content[1].source.media_type,
    "image/png"
  );
  eq(
    "providerStream: anthropic api key header",
    (ant.init.headers as Record<string, string>)["x-api-key"],
    "k"
  );

  const oai = buildProviderRequest({ ...base, type: "openai", apiKey: "k" });
  const oaiBody = JSON.parse(String(oai.init.body));
  eq("providerStream: openai url", oai.url, "http://h/chat/completions");
  eq("providerStream: openai image part", oaiBody.messages[1].content[1].type, "image_url");
  eq(
    "providerStream: openai bearer",
    (oai.init.headers as Record<string, string>).Authorization,
    "Bearer k"
  );

  eq("providerStream: keepAlive '-1' → number", normalizeKeepAlive("-1"), -1);
  eq("providerStream: keepAlive '2m' stays string", normalizeKeepAlive("2m"), "2m");
  eq("providerStream: keepAlive empty → undefined", normalizeKeepAlive(""), undefined);
  ok("providerStream: ollama budget bounded by num_ctx", tokenBudgetFor("ollama", 100) < NUM_CTX);
  eq("providerStream: cloud budget flat", tokenBudgetFor("openai", 100), 24_000);

  // Normalization against a fake provider: the extracted transforms must still
  // split answer text ("c") from reasoning ("r") for all three wire formats.
  const http = await import("http");
  const collect = async (
    type: "ollama" | "anthropic" | "openai",
    payload: string,
    contentType: string
  ) => {
    const srv = http.createServer((_q, res) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(payload);
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    try {
      const stream = await streamProvider({
        type,
        baseUrl: `http://127.0.0.1:${port}`,
        model: "m",
        messages: [{ role: "user", content: "x" }],
      });
      let out = "";
      const reader = stream.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out += dec.decode(value, { stream: true });
      }
      return out
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { t: string; v: string });
    } finally {
      // Await the close: exiting while a handle is still closing trips a libuv
      // assertion on Windows.
      await new Promise<void>((r) => srv.close(() => r()));
    }
  };

  eq(
    "providerStream: ollama NDJSON → c/r",
    await collect(
      "ollama",
      '{"message":{"thinking":"denk","content":"Hallo"}}\n{"message":{"content":" Welt"}}\n',
      "application/x-ndjson"
    ),
    [
      { t: "r", v: "denk" },
      { t: "c", v: "Hallo" },
      { t: "c", v: " Welt" },
    ]
  );
  eq(
    "providerStream: anthropic SSE → c/r",
    await collect(
      "anthropic",
      'data: {"type":"content_block_delta","delta":{"thinking":"denk"}}\n\n' +
        'data: {"type":"content_block_delta","delta":{"text":"Hallo"}}\n\n' +
        'data: {"type":"message_stop"}\n\n',
      "text/event-stream"
    ),
    [
      { t: "r", v: "denk" },
      { t: "c", v: "Hallo" },
    ]
  );
  eq(
    "providerStream: openai SSE → c/r",
    await collect(
      "openai",
      'data: {"choices":[{"delta":{"reasoning_content":"denk"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"Hallo"}}]}\n\n' +
        "data: [DONE]\n\n",
      "text/event-stream"
    ),
    [
      { t: "r", v: "denk" },
      { t: "c", v: "Hallo" },
    ]
  );

  // A failing upstream must arrive as a translated ProviderError, not a throw
  // from deep inside fetch.
  const { ProviderError } = await import("../lib/server/providerStream");
  const bad = http.createServer((_q, res) => {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end('{"error":{"message":"rate limited"}}');
  });
  await new Promise<void>((r) => bad.listen(0, "127.0.0.1", r));
  const badPort = (bad.address() as { port: number }).port;
  try {
    await streamProvider({
      type: "openai",
      baseUrl: `http://127.0.0.1:${badPort}`,
      model: "m",
      messages: [{ role: "user", content: "x" }],
    });
    ok("providerStream: upstream error throws", false, "no throw");
  } catch (e) {
    ok(
      "providerStream: upstream error unwrapped",
      e instanceof ProviderError && e.message.includes("rate limited") && e.status === 502,
      String(e)
    );
  } finally {
    await new Promise<void>((r) => bad.close(() => r()));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
// Set the code instead of process.exit(): the providerStream tests leave undici
// keep-alive sockets in the pool, and exiting while those handles are closing
// trips a libuv assertion on Windows. Draining the loop is the safe way out.
process.exitCode = fail ? 1 : 0;
