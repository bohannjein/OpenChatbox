import http from "node:http";
import https from "node:https";
import {
  getBookstackConfig,
  getConfig,
  getProviders,
  getProperNouns,
  type BookstackResolved,
} from "./config";
import { parseModelKey } from "@/lib/providers";
import { completeOnce } from "./complete";
import { correctProperNouns } from "./spellfix";

/**
 * BookStack integration: translate LLM tool calls into BookStack REST API
 * requests. Communicates directly with the BookStack instance (no MCP
 * subprocess) using the token auth header `Authorization: Token <id>:<secret>`.
 *
 * Tools are split into READ (search/get/list) and WRITE (create/update/delete).
 * When the admin disables write access, the destructive tools are never exposed
 * to the model — enforced in `toolDefs()` below and re-checked in `runTool()`.
 */

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the arguments (OpenAI/Ollama function-calling shape). */
  parameters: Record<string, unknown>;
  write: boolean;
}

export interface SourceLink {
  title: string;
  url: string;
}
export interface ToolResult {
  text: string;
  sources?: SourceLink[];
}

/** Short human-readable label for the live chat badge, per tool. */
export function toolLabel(name: string, args: Record<string, unknown>): string {
  const q = typeof args.query === "string" ? `„${args.query}"` : "";
  const nm = typeof args.name === "string" ? `„${args.name}"` : "";
  switch (name) {
    case "bookstack_search":
      return `Durchsuche Wiki nach ${q}`.trim();
    case "bookstack_list_books":
      return "Lese Bücherliste";
    case "bookstack_list_pages":
      return "Lese Buchinhalt";
    case "bookstack_get_page":
      return "Lese Wiki-Seite";
    case "bookstack_create_page":
      return `Erstelle Wiki-Seite ${nm}`.trim();
    case "bookstack_update_page":
      return "Bearbeite Wiki-Seite";
    case "bookstack_delete_page":
      return "Lösche Wiki-Seite";
    default:
      return name;
  }
}

const ALL_TOOLS: ToolDef[] = [
  {
    name: "bookstack_search",
    description:
      "Durchsucht das gesamte BookStack-Wiki (Bücher, Kapitel, Seiten) per Volltextsuche und liefert Treffer mit Titel, URL und Auszug.",
    write: false,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Der Suchbegriff. Nutze BookStack-Filter für maximale Präzision: Nutze Anführungszeichen "suchbegriff" für exakte Treffer. Nutze \'{in_name:begriff}\', um gezielt nur in Seitentiteln zu suchen. Nutze \'{type:page}\' oder \'{type:book}\', um nach bestimmten Typen zu filtern. Beispiel: \'"Docker Setup" {in_name:Docker} {type:page}\'',
        },
        count: { type: "integer", description: "Max. Treffer (Standard 6)" },
      },
      required: ["query"],
    },
  },
  {
    name: "bookstack_list_books",
    description: "Listet alle Bücher (Top-Level-Sammlungen) im Wiki mit id und Name.",
    write: false,
    parameters: { type: "object", properties: {} },
  },
  {
    name: "bookstack_list_pages",
    description:
      "Listet Kapitel und Seiten innerhalb eines Buches (per book_id) mit ihren Seiten-IDs.",
    write: false,
    parameters: {
      type: "object",
      properties: { book_id: { type: "integer", description: "ID des Buches" } },
      required: ["book_id"],
    },
  },
  {
    name: "bookstack_get_page",
    description:
      "Hole den vollständigen Markdown-Inhalt einer spezifischen Wiki-Seite anhand ihrer ID. Suchergebnisse liefern nur Titel — nutze dieses Tool, um eine Seite tatsächlich zu LESEN, bevor du ihren Inhalt beurteilst.",
    write: false,
    parameters: {
      type: "object",
      properties: {
        page_id: { type: "integer", description: "Die ID der zu lesenden Seite" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "bookstack_create_page",
    description:
      "Erstellt eine neue Wiki-Seite in einem Buch (book_id) mit Titel (name) und Markdown-Inhalt.",
    write: true,
    parameters: {
      type: "object",
      properties: {
        book_id: { type: "integer", description: "ID des Zielbuches" },
        name: { type: "string", description: "Titel der Seite" },
        markdown: { type: "string", description: "Seiteninhalt als Markdown" },
      },
      required: ["book_id", "name", "markdown"],
    },
  },
  {
    name: "bookstack_update_page",
    description:
      "Aktualisiert eine bestehende Wiki-Seite (page_id): Titel und/oder Markdown-Inhalt.",
    write: true,
    parameters: {
      type: "object",
      properties: {
        page_id: { type: "integer", description: "ID der Seite" },
        name: { type: "string", description: "Neuer Titel (optional)" },
        markdown: { type: "string", description: "Neuer Markdown-Inhalt (optional)" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "bookstack_delete_page",
    description: "Löscht eine Wiki-Seite endgültig anhand ihrer page_id.",
    write: true,
    parameters: {
      type: "object",
      properties: { page_id: { type: "integer", description: "ID der Seite" } },
      required: ["page_id"],
    },
  },
];

/** Tool definitions available to the model, filtered by write permission. */
export function toolDefs(writeEnabled: boolean): ToolDef[] {
  return writeEnabled ? ALL_TOOLS : ALL_TOOLS.filter((t) => !t.write);
}

/**
 * Anti-drift search protocol injected as a system message whenever the BookStack
 * tools are active. Bounds retries (no infinite tool loops), forbids answering
 * "not in the wiki" before actually reading candidate pages, prescribes the
 * search → read → answer-with-source flow, and — on error/"doesn't work" intent —
 * deep-scans the page for troubleshooting/fallback sections and autonomously
 * follows links to alternative pages.
 */
export const BOOKSTACK_SYSTEM_PROMPT = `PRODUKTIV-REGELN FÜR DIE BOOKSTACK-SUCHE:
1. Such-Limit (Max 2 Versuche): Wenn du einen Begriff suchst und nach maximal zwei unterschiedlichen Suchanfragen (z.B. einmal breit, einmal exakt mit Anführungszeichen) kein passendes Ergebnis findest, stoppe sofort. Halluziniere keine Inhalte und starte keine Endlosschleife. Frage stattdessen den Nutzer nach dem genauen Pfad oder dem Namen der Seite.
2. Erst Lesen, dann behaupten: Behaupte niemals, dass eine Information nicht im Wiki steht, bevor du nicht die verdächtigen Seiten mit 'bookstack_get_page' tatsächlich geöffnet und gelesen hast. Suchergebnisse liefern dir nur die Titel!
3. Strukturierter Ablauf bei Wissensfragen:
   - Schritt A: Nutze 'bookstack_search' mit '{in_name:Suchbegriff}' für eine präzise Suche.
   - Schritt B: Analysiere die IDs der Suchergebnisse.
   - Schritt C: Rufe die relevanteste Seite mit 'bookstack_get_page' ab und lies den Inhalt.
   - Schritt D: Beantworte die Nutzerfrage präzise unter Angabe der BookStack-Seiten-ID als Quelle.
4. Ausgabe: Diese Schritte (A–D) und deine Analyse der Quellen sind deine INTERNE Vorgehensweise. Gib sie NIEMALS im Antworttext aus (kein "Thinking Process", keine "Scan Sources"-Aufzählung). Antworte dem Nutzer ausschließlich mit dem fertigen Ergebnis.
5. Nichts gefunden = sag es: Wenn du nach den erlaubten Suchversuchen nichts Passendes findest, teile dem Nutzer klar mit, dass die gesuchte Information nicht im Wiki steht. Erfinde niemals Inhalte.

TROUBLESHOOTING, FEHLERBEHEBUNG & ALTERNATIVEN:
1. Fehler-Intent erkennen: Sobald der Nutzer signalisiert, dass eine Anleitung nicht funktioniert (z. B. "geht nicht", "Fehler", "klappt nicht", "Alternative?", "andere Lösung"), schalte sofort in den "Troubleshooting-Scan-Modus".
2. Tiefenscan der aktuellen Seite: Lies die geöffnete Wiki-Seite nicht nur oberflächlich. Suche gezielt nach Abschnitten wie "Fehlerbehebung", "Troubleshooting", "Fallback", "Alternative", "Einschränkungen" oder "Wichtig".
3. Proaktive Link-Verfolgung (Crucial Rule):
   - Wenn im Troubleshooting-Abschnitt der aktuellen Seite auf eine andere Wiki-Seite oder ein anderes Buch verwiesen wird (z. B. "Nutzen Sie stattdessen die Anleitung für den blauen Keyreader [Link/ID 456]"), darfst du nicht stoppen.
   - Rufe SOFORT und autonom im selben Schritt diese verlinkte Seite mit 'bookstack_get_page' ab, um die Alternative direkt parat zu haben.
4. Lösungsorientierte Antwortstruktur: Formuliere deine Antwort bei Problemen immer proaktiv und biete Auswege an:
   - "Ich sehe, dass die Einrichtung des schwarzen Keyreaders bei dir fehlschlägt. Laut Wiki gibt es dafür folgenden Fallback: [Schritt-für-Schritt-Alternative aus dem Wiki]. Alternativ verweist der Eintrag auf die Anleitung für den blauen Keyreader. Soll ich diese für dich öffnen?"

RECHTSCHREIBUNG & AUTOMATISCHE KORREKTUR:
- Wenn ein Suchergebnis einen Hinweis auf eine automatische Korrektur enthält (der ursprüngliche Begriff ergab 0 Treffer und es wurde stattdessen ein korrigierter Begriff gesucht), weise den Nutzer charmant und knapp darauf hin, z. B.: "Ich habe in deinem Suchbegriff einen Tippfehler vermutet und stattdessen erfolgreich nach 'laufwerk sasdir' gesucht. Folgendes habe ich gefunden …". Verschweige die Korrektur nicht.`;

// ── REST helpers ────────────────────────────────────────────────────────────

/** BookStack token auth. Exact format the API expects: `Token <id>:<secret>`
 *  (the literal word "Token", a space, then id and secret joined by a colon). */
function authHeader(cfg: BookstackResolved): Record<string, string> {
  return { Authorization: `Token ${cfg.tokenId}:${cfg.tokenSecret}` };
}

const TIMEOUT_MS = 15_000;

// Homelab escape hatch: many BookStack instances run on a self-signed cert or a
// .local/.lan domain, which Node rejects by default. When the admin opts in we
// attach an https.Agent that skips cert verification — ONLY for BookStack calls,
// never the global NODE_TLS_REJECT_UNAUTHORIZED (which would weaken every fetch).
let insecureAgent: https.Agent | null = null;
function insecureHttpsAgent(): https.Agent {
  if (!insecureAgent) insecureAgent = new https.Agent({ rejectUnauthorized: false });
  return insecureAgent;
}

interface RawResponse {
  status: number;
  ok: boolean;
  text: string;
}

/**
 * Low-level HTTP(S) request via Node's http/https so we can control TLS per call
 * (native fetch/undici can't disable cert checks per request). Rejects with an
 * error carrying `.code` (e.g. DEPTH_ZERO_SELF_SIGNED_CERT, ECONNREFUSED).
 */
function rawRequest(
  urlStr: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    allowInsecure: boolean;
  }
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      reject(new Error(`Ungültige BookStack-URL: ${urlStr}`));
      return;
    }
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const agent =
      isHttps && opts.allowInsecure ? insecureHttpsAgent() : undefined;

    const req = lib.request(
      url,
      { method: opts.method, headers: opts.headers, agent, timeout: TIMEOUT_MS },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("timeout", () => {
      const e = new Error("timeout") as Error & { code?: string };
      e.code = "ETIMEDOUT";
      req.destroy(e);
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Translate a thrown request error into a precise German diagnosis. */
function describeFetchError(e: unknown): string {
  const err = e as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  const code = err?.code || err?.cause?.code || "";
  const byCode: Record<string, string> = {
    ENOTFOUND:
      "Hostname nicht auflösbar (DNS). Prüfe die URL — oder trage die IP-Adresse statt des Hostnamens ein.",
    ECONNREFUSED: "Verbindung abgelehnt (Server aus, falscher Port oder Firewall).",
    ETIMEDOUT: "Zeitüberschreitung — Server antwortet nicht.",
    EAI_AGAIN:
      "DNS-Auflösung fehlgeschlagen: Der Chatbox-Server (bzw. Docker-Container) kann diesen Hostnamen nicht auflösen. Nutze die IP-Adresse statt des Hostnamens, oder setze einen DNS-/extra_hosts-Eintrag. .local/.lan-Namen funktionieren aus Containern meist nicht.",
    ECONNRESET: "Verbindung zurückgesetzt (evtl. HTTP statt HTTPS oder umgekehrt).",
    DEPTH_ZERO_SELF_SIGNED_CERT:
      "SSL-Fehler: selbst-signiertes Zertifikat. Aktiviere „TLS-Zertifikat ignorieren“.",
    SELF_SIGNED_CERT_IN_CHAIN:
      "SSL-Fehler: selbst-signiertes Zertifikat in der Kette. Aktiviere „TLS-Zertifikat ignorieren“.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE:
      "SSL-Fehler: Zertifikatskette nicht verifizierbar. Aktiviere „TLS-Zertifikat ignorieren“.",
    CERT_HAS_EXPIRED: "SSL-Fehler: Zertifikat abgelaufen.",
    ERR_TLS_CERT_ALTNAME_INVALID:
      "SSL-Fehler: Hostname passt nicht zum Zertifikat (CN/SAN).",
  };
  if (code && byCode[code]) return byCode[code];
  return err?.message ? `${err.message}${code ? ` (${code})` : ""}` : String(e);
}

/** One authenticated BookStack request. Throws a friendly Error on a network/
 *  TLS failure or a non-2xx status; returns the raw response otherwise. */
async function send(
  cfg: BookstackResolved,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<RawResponse> {
  const url = `${cfg.baseUrl}/api${pathAndQuery}`;
  const payload = body ? JSON.stringify(body) : undefined;

  let res: RawResponse;
  try {
    res = await rawRequest(url, {
      method,
      headers: {
        ...authHeader(cfg),
        ...(payload ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
      },
      body: payload,
      allowInsecure: cfg.allowInsecure,
    });
  } catch (e) {
    const msg = describeFetchError(e);
    console.error(`[bookstack] ${method} ${url} → Netzwerk-/TLS-Fehler: ${msg}`);
    throw new Error(msg);
  }

  if (!res.ok) {
    let msg = res.text;
    try {
      const j = JSON.parse(res.text);
      msg = j?.error?.message || j?.message || res.text;
    } catch {
      /* keep raw */
    }
    console.error(
      `[bookstack] ${method} ${url} → HTTP ${res.status}: ${String(msg).slice(0, 300)}`
    );
    throw new Error(`BookStack HTTP ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  console.log(`[bookstack] ${method} ${url} → HTTP ${res.status} OK (${res.text.length} B)`);
  return res;
}

/** JSON request helper (parses the response body). */
async function api<T = unknown>(
  cfg: BookstackResolved,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<T> {
  const res = await send(cfg, method, pathAndQuery, body);
  return (res.text ? JSON.parse(res.text) : {}) as T;
}

/** Raw-text GET helper — for endpoints that return a file/markdown, not JSON. */
async function apiText(cfg: BookstackResolved, pathAndQuery: string): Promise<string> {
  return (await send(cfg, "GET", pathAndQuery)).text;
}

export interface TestResult {
  ok: boolean;
  status?: number;
  count?: number;
  error?: string;
}

/**
 * Connection self-test for the admin UI: hits GET /api/books?count=1 and reports
 * the book total, or a precise reason (SSL / 401 / unreachable). Takes a resolved
 * config directly so the admin can test credentials *before* saving them.
 */
export async function testConnection(cfg: BookstackResolved): Promise<TestResult> {
  const url = `${cfg.baseUrl}/api/books?count=1`;
  console.log(
    `[bookstack] Verbindungstest → GET ${url} (allowInsecure=${cfg.allowInsecure})`
  );
  let res: RawResponse;
  try {
    res = await rawRequest(url, {
      method: "GET",
      headers: { ...authHeader(cfg), Accept: "application/json" },
      allowInsecure: cfg.allowInsecure,
    });
  } catch (e) {
    const error = describeFetchError(e);
    console.error(`[bookstack] Verbindungstest fehlgeschlagen: ${error}`);
    return { ok: false, error };
  }

  if (!res.ok) {
    let msg = res.text;
    try {
      const j = JSON.parse(res.text);
      msg = j?.error?.message || j?.message || res.text;
    } catch {
      /* keep raw */
    }
    const error =
      res.status === 401
        ? "401 Unauthorized — Token ID/Secret falsch oder Token ohne Berechtigung."
        : res.status === 403
        ? "403 Forbidden — Token hat keine API-Berechtigung in BookStack."
        : `HTTP ${res.status}: ${String(msg).slice(0, 200)}`;
    console.error(`[bookstack] Verbindungstest → ${error}`);
    return { ok: false, status: res.status, error };
  }

  let count = 0;
  try {
    const j = JSON.parse(res.text) as { total?: number; data?: unknown[] };
    count =
      typeof j.total === "number" ? j.total : Array.isArray(j.data) ? j.data.length : 0;
  } catch {
    /* keep 0 */
  }
  console.log(`[bookstack] Verbindungstest erfolgreich — ${count} Bücher gefunden.`);
  return { ok: true, status: res.status, count };
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
};

/** Best-effort public URL of a page (needs its book's slug). */
async function pageUrl(
  cfg: BookstackResolved,
  page: { slug?: string; book_id?: number; book_slug?: string }
): Promise<string> {
  const pageSlug = page.slug;
  if (!pageSlug) return cfg.baseUrl;
  let bookSlug = page.book_slug;
  if (!bookSlug && page.book_id != null) {
    try {
      const book = await api<{ slug?: string }>(cfg, "GET", `/books/${page.book_id}`);
      bookSlug = book.slug;
    } catch {
      /* ignore — fall back to base */
    }
  }
  return bookSlug
    ? `${cfg.baseUrl}/books/${bookSlug}/page/${pageSlug}`
    : `${cfg.baseUrl}`;
}

// ── Search with fuzzy + spellcheck fallback ──────────────────────────────────

const SPELLCHECK_SYSTEM = `Du bist ein extrem schneller, präziser Rechtschreibprüfer für IT-Dokumentationen.
Deine Aufgabe ist es, Tippfehler, Buchstabendreher oder falsche Trennungen im Suchbegriff des Nutzers zu korrigieren.
Gib AUSSCHLIESSLICH den korrigierten Suchbegriff zurück – keine Erklärungen, kein Smalltalk, keine Anführungszeichen.

Beispiel-Input: "alufwerk sasdir"
Beispiel-Output: "laufwerk sasdir"`;

/** One raw /search call → the hit array. */
async function searchRaw(
  cfg: BookstackResolved,
  query: string,
  count: number
): Promise<Array<Record<string, unknown>>> {
  const r = await api<{ data?: Array<Record<string, unknown>> }>(
    cfg,
    "GET",
    `/search?query=${encodeURIComponent(query)}&count=${count}`
  );
  return r.data ?? [];
}

/**
 * Tokenize + wildcard: drop fillers under 3 chars, append a `*` wildcard to
 * every word longer than 4 chars ("alufwer" → "alufwer*") so a near-miss still
 * matches BookStack's stricter full-text index.
 */
export function wildcardQuery(query: string): string {
  return query
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")) // trim punctuation
    .filter((w) => w.length >= 3)
    .map((w) => (w.length > 4 ? `${w}*` : w))
    .join(" ")
    .trim();
}

/** LLM spellcheck via the configured search/standard query model. */
async function spellcheckQuery(query: string): Promise<string | null> {
  const conf = getConfig();
  const key = conf.routerModels?.search || conf.routerModels?.standard;
  if (!key) return null;
  const { providerId, model } = parseModelKey(key);
  const provider = getProviders().find((p) => p.id === providerId);
  if (!provider || !model) return null;
  try {
    const out = await completeOnce({
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      system: SPELLCHECK_SYSTEM,
      user: query,
      maxTokens: 32,
      timeoutMs: 10_000,
    });
    const corrected = out.split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!corrected || corrected.length > 200) return null;
    return corrected;
  } catch (e) {
    console.error(
      `[bookstack] Spellcheck fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`
    );
    return null;
  }
}

export interface SearchOutcome {
  items: Array<Record<string, unknown>>;
  /** set only when stage-2 spellcheck correction produced the hits. */
  correctedQuery?: string;
}

/**
 * Two-stage search fallback. Stage 0: exact query. Stage 1 (on 0 hits): tokenized
 * wildcard. Stage 2 (still 0 hits): LLM spellcheck → search the corrected term
 * (and its wildcard form). `correctedQuery` is set only for a successful stage-2
 * correction, so the UI/model can tell the user about the typo fix.
 */
async function searchWithFallback(
  cfg: BookstackResolved,
  query: string,
  count: number
): Promise<SearchOutcome> {
  // Stage 0 — deterministic company/proper-noun correction (Levenshtein vs the
  // admin dictionary). Runs FIRST: a mistyped proper noun ("ipsa hab") makes the
  // whole query miss, so we fix it before any search is attempted.
  const pn = correctProperNouns(query, getProperNouns());
  const base = pn.corrected;
  // Surface a proper-noun fix to the user just like a spellcheck fix.
  const properNounFix = pn.replacements.length ? base : undefined;
  if (properNounFix)
    console.log(
      `[bookstack] Eigennamen-Korrektur: „${query}" → „${base}" (${pn.replacements
        .map((r) => `${r.from}→${r.to}`)
        .join(", ")}).`
    );

  let items = await searchRaw(cfg, base, count);
  if (items.length) return { items, correctedQuery: properNounFix };
  console.log(`[bookstack] „${base}": 0 Treffer → Wildcard-Fallback.`);

  // Stage 1 — tokenized wildcard.
  const wq = wildcardQuery(base);
  if (wq && wq !== base) {
    items = await searchRaw(cfg, wq, count);
    if (items.length) {
      console.log(`[bookstack] Wildcard „${wq}": ${items.length} Treffer.`);
      return { items, correctedQuery: properNounFix };
    }
  }

  // Stage 2 — LLM spellcheck (on the proper-noun-corrected base).
  const corrected = await spellcheckQuery(base);
  if (corrected && corrected.toLowerCase() !== base.toLowerCase()) {
    console.log(`[bookstack] Rechtschreibkorrektur: „${base}" → „${corrected}".`);
    items = await searchRaw(cfg, corrected, count);
    if (items.length) return { items, correctedQuery: corrected };
    const cwq = wildcardQuery(corrected);
    if (cwq && cwq !== corrected) {
      items = await searchRaw(cfg, cwq, count);
      if (items.length) return { items, correctedQuery: corrected };
    }
  }
  return { items: [] };
}

/**
 * Deterministic BookStack retrieval for the knowledge-base toggle. Searches the
 * wiki, reads the top matching pages' Markdown, and returns a compact context
 * block plus clickable sources. Unlike the agentic tool loop this ALWAYS runs
 * when invoked, so a KB turn reliably consults BookStack even with models that
 * are unreliable at function-calling. Returns empty text when not configured or
 * nothing relevant is found (the chat then answers without wiki context).
 */
export async function retrieveContext(
  query: string,
  maxPages = 3
): Promise<{ text: string; sources: SourceLink[]; correctedQuery?: string }> {
  const cfg = getBookstackConfig();
  if (!cfg) return { text: "", sources: [] };
  const q = query.trim();
  if (!q) return { text: "", sources: [] };

  let hits: Array<Record<string, unknown>> = [];
  let correctedQuery: string | undefined;
  try {
    const outcome = await searchWithFallback(cfg, q, 8);
    hits = outcome.items;
    correctedQuery = outcome.correctedQuery;
  } catch (e) {
    console.error(
      `[bookstack] KB-Suche „${q}" fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`
    );
    return { text: "", sources: [] };
  }

  // Prefer pages (books/chapters carry no readable body of their own).
  const pages = hits.filter((h) => String(h.type ?? "") === "page");
  const targets = (pages.length ? pages : hits).slice(0, maxPages);
  if (!targets.length) {
    console.log(`[bookstack] KB-Suche „${q}": keine Treffer.`);
    return { text: "", sources: [] };
  }

  const blocks: string[] = [];
  const sources: SourceLink[] = [];
  for (const it of targets) {
    const id = num(it.id);
    const nm = String(it.name ?? "(ohne Titel)");
    const url = typeof it.url === "string" ? it.url : cfg.baseUrl;
    let body = "";
    if (id != null && String(it.type ?? "page") === "page") {
      try {
        body = (await apiText(cfg, `/pages/${id}/export/markdown`)).trim();
      } catch {
        /* fall back to the search preview */
      }
    }
    if (!body)
      body = (
        (it.preview_html as { content?: string })?.content?.replace(/<[^>]+>/g, "") ?? ""
      ).trim();
    if (!body) continue;
    blocks.push(`(Quelle: ${nm} — BookStack-ID ${id ?? "?"})\n${body.slice(0, 2500)}`);
    if (url) sources.push({ title: nm, url });
  }
  if (!blocks.length) {
    console.log(`[bookstack] KB-Suche „${q}": Treffer ohne lesbaren Inhalt.`);
    return { text: "", sources: [] };
  }

  console.log(
    `[bookstack] KB-Suche „${q}"${
      correctedQuery ? ` (korrigiert → „${correctedQuery}")` : ""
    }: ${blocks.length} Seite(n) eingebettet.`
  );
  const correctionNote = correctedQuery
    ? `Hinweis: Der ursprüngliche Suchbegriff „${q}" ergab 0 Treffer; er wurde automatisch zu ` +
      `„${correctedQuery}" korrigiert. Weise den Nutzer charmant auf diese Tippfehler-Korrektur ` +
      `hin, z. B.: „Ich habe in deinem Suchbegriff einen Tippfehler vermutet und stattdessen ` +
      `nach ‚${correctedQuery}' gesucht. Folgendes habe ich gefunden …“.\n\n`
    : "";
  const text =
    correctionNote +
    "Auszüge aus dem BookStack-Wiki. Beantworte die Frage bevorzugt auf Basis dieser " +
    "Auszüge und belege Aussagen mit der Quelle als (Quelle: <Seitenname>, BookStack-ID <id>). " +
    "Wenn die Auszüge die Frage NICHT beantworten, sage klar, dass du dazu nichts im Wiki " +
    "gefunden hast, und erfinde nichts. Gib NICHT deinen Denkprozess oder deine Suchschritte " +
    "aus — antworte nur mit dem Ergebnis.\n\n" +
    blocks.join("\n\n---\n\n");
  return { text, sources, correctedQuery };
}

// ── Tool execution ───────────────────────────────────────────────────────────

/**
 * Execute one tool call. Re-checks the write permission (defense in depth) so a
 * hallucinated destructive call is refused even if it slipped past the filter.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  writeEnabled: boolean
): Promise<ToolResult> {
  console.log(
    `[bookstack] Tool-Call „${name}" args=${JSON.stringify(args)} (writeEnabled=${writeEnabled})`
  );
  const cfg = getBookstackConfig();
  if (!cfg) {
    console.error("[bookstack] Tool-Call abgebrochen: nicht konfiguriert.");
    return { text: "Fehler: BookStack ist nicht konfiguriert." };
  }

  const def = ALL_TOOLS.find((t) => t.name === name);
  if (!def) return { text: `Unbekanntes Tool: ${name}` };
  if (def.write && !writeEnabled) {
    console.error(`[bookstack] Tool „${name}" verweigert: Schreibzugriff deaktiviert.`);
    return {
      text: "Schreibzugriff ist deaktiviert. Diese Aktion (Erstellen/Ändern/Löschen) ist nicht erlaubt.",
    };
  }

  try {
    switch (name) {
      case "bookstack_search": {
        const query = String(args.query ?? "").trim();
        const count = Math.min(Math.max(num(args.count) ?? 6, 1), 15);
        if (!query) return { text: "Kein Suchbegriff angegeben." };
        const { items, correctedQuery } = await searchWithFallback(cfg, query, count);
        if (!items.length)
          return {
            text: `Keine Treffer für „${query}" (auch nach Fuzzy-Suche und automatischer Rechtschreibkorrektur).`,
          };
        const sources: SourceLink[] = [];
        const lines = items.map((it) => {
          const type = String(it.type ?? "eintrag");
          const id = it.id;
          const name = String(it.name ?? "(ohne Titel)");
          const url = typeof it.url === "string" ? it.url : "";
          const preview =
            (it.preview_html as { content?: string })?.content?.replace(/<[^>]+>/g, "") ??
            "";
          if (url) sources.push({ title: `${name}`, url });
          return `- [${type} #${id}] ${name}${
            preview ? ` — ${preview.slice(0, 160)}` : ""
          }${url ? ` (${url})` : ""}`;
        });
        const header = correctedQuery
          ? `Hinweis: „${query}" ergab 0 Treffer; automatisch zu „${correctedQuery}" korrigiert. ` +
            `Weise den Nutzer charmant auf diese Tippfehler-Korrektur hin. Treffer für „${correctedQuery}":`
          : `Treffer für „${query}":`;
        return { text: `${header}\n${lines.join("\n")}`, sources };
      }

      case "bookstack_list_books": {
        const r = await api<{ data?: Array<{ id: number; name: string; slug?: string }> }>(
          cfg,
          "GET",
          `/books?count=100`
        );
        const books = r.data ?? [];
        if (!books.length) return { text: "Keine Bücher vorhanden." };
        return {
          text:
            "Bücher:\n" +
            books.map((b) => `- #${b.id} ${b.name}`).join("\n"),
        };
      }

      case "bookstack_list_pages": {
        const bookId = num(args.book_id);
        if (bookId == null) return { text: "book_id fehlt oder ungültig." };
        const book = await api<{
          name?: string;
          contents?: Array<{ id: number; name: string; type: string }>;
        }>(cfg, "GET", `/books/${bookId}`);
        const contents = book.contents ?? [];
        if (!contents.length)
          return { text: `Buch „${book.name ?? bookId}" hat keine Seiten.` };
        return {
          text:
            `Inhalt von „${book.name ?? bookId}":\n` +
            contents
              .map((c) => `- [${c.type} #${c.id}] ${c.name}`)
              .join("\n"),
        };
      }

      case "bookstack_get_page": {
        const pageId = num(args.page_id);
        if (pageId == null) return { text: "page_id fehlt oder ungültig." };
        // Metadata (title/slug/book) for the title + source link.
        const p = await api<{
          name?: string;
          slug?: string;
          book_id?: number;
          markdown?: string;
          html?: string;
        }>(cfg, "GET", `/pages/${pageId}`);
        // Prefer BookStack's clean Markdown export; fall back to the page's own
        // markdown, then a tag-stripped html — so HTML-authored pages still read
        // as sensible text instead of raw markup.
        let bodyMd = "";
        try {
          bodyMd = (await apiText(cfg, `/pages/${pageId}/export/markdown`)).trim();
        } catch (e) {
          console.error(
            `[bookstack] Markdown-Export für Seite #${pageId} fehlgeschlagen, nutze Fallback: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        }
        if (!bodyMd)
          bodyMd = (p.markdown || (p.html ? p.html.replace(/<[^>]+>/g, " ") : "") || "")
            .toString()
            .trim();
        const url = await pageUrl(cfg, p);
        return {
          text: `Seite „${p.name ?? pageId}" (#${pageId}):\n\n${
            bodyMd.slice(0, 6000) || "(kein Inhalt)"
          }`,
          sources: p.name ? [{ title: p.name, url }] : undefined,
        };
      }

      case "bookstack_create_page": {
        const bookId = num(args.book_id);
        const name = String(args.name ?? "").trim();
        const markdown = String(args.markdown ?? "");
        if (bookId == null || !name)
          return { text: "book_id und name sind erforderlich." };
        const p = await api<{ id: number; name: string; slug?: string; book_id?: number }>(
          cfg,
          "POST",
          `/pages`,
          { book_id: bookId, name, markdown }
        );
        const url = await pageUrl(cfg, p);
        return {
          text: `Seite „${p.name}" (#${p.id}) wurde erstellt.`,
          sources: [{ title: p.name, url }],
        };
      }

      case "bookstack_update_page": {
        const pageId = num(args.page_id);
        if (pageId == null) return { text: "page_id fehlt oder ungültig." };
        const patch: Record<string, unknown> = {};
        if (typeof args.name === "string" && args.name.trim()) patch.name = args.name;
        if (typeof args.markdown === "string") patch.markdown = args.markdown;
        if (!Object.keys(patch).length)
          return { text: "Nichts zu aktualisieren (name/markdown fehlen)." };
        const p = await api<{ id: number; name: string; slug?: string; book_id?: number }>(
          cfg,
          "PUT",
          `/pages/${pageId}`,
          patch
        );
        const url = await pageUrl(cfg, p);
        return {
          text: `Seite „${p.name}" (#${p.id}) wurde aktualisiert.`,
          sources: [{ title: p.name, url }],
        };
      }

      case "bookstack_delete_page": {
        const pageId = num(args.page_id);
        if (pageId == null) return { text: "page_id fehlt oder ungültig." };
        await api(cfg, "DELETE", `/pages/${pageId}`);
        return { text: `Seite #${pageId} wurde gelöscht.` };
      }

      default:
        return { text: `Unbekanntes Tool: ${name}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bookstack] Tool „${name}" fehlgeschlagen: ${msg}`);
    return { text: `Fehler beim Tool ${name}: ${msg}` };
  }
}
