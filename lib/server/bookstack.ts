import http from "node:http";
import https from "node:https";
import { getBookstackConfig, type BookstackResolved } from "./config";

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
        query: { type: "string", description: "Suchbegriff / Frage" },
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
      "Liest den vollständigen Inhalt (Markdown) einer Wiki-Seite anhand ihrer page_id.",
    write: false,
    parameters: {
      type: "object",
      properties: { page_id: { type: "integer", description: "ID der Seite" } },
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
    ENOTFOUND: "Server nicht erreichbar (Hostname/DNS nicht gefunden).",
    ECONNREFUSED: "Verbindung abgelehnt (Server aus, falscher Port oder Firewall).",
    ETIMEDOUT: "Zeitüberschreitung — Server antwortet nicht.",
    EAI_AGAIN: "DNS-Auflösung fehlgeschlagen (Netzwerk/DNS-Problem).",
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

async function api<T = unknown>(
  cfg: BookstackResolved,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<T> {
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
  return (res.text ? JSON.parse(res.text) : {}) as T;
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
        const r = await api<{ data?: Array<Record<string, unknown>> }>(
          cfg,
          "GET",
          `/search?query=${encodeURIComponent(query)}&count=${count}`
        );
        const items = r.data ?? [];
        if (!items.length) return { text: `Keine Treffer für „${query}".` };
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
        return {
          text: `Treffer für „${query}":\n${lines.join("\n")}`,
          sources,
        };
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
        const p = await api<{
          name?: string;
          slug?: string;
          book_id?: number;
          markdown?: string;
          html?: string;
        }>(cfg, "GET", `/pages/${pageId}`);
        const bodyMd = (p.markdown || p.html || "").toString();
        const url = await pageUrl(cfg, p);
        return {
          text: `Seite „${p.name ?? pageId}" (#${pageId}):\n\n${bodyMd.slice(0, 6000)}`,
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
