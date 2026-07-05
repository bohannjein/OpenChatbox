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

function authHeader(cfg: BookstackResolved): Record<string, string> {
  return { Authorization: `Token ${cfg.tokenId}:${cfg.tokenSecret}` };
}

async function api<T = unknown>(
  cfg: BookstackResolved,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}/api${pathAndQuery}`, {
    method,
    headers: {
      ...authHeader(cfg),
      ...(body ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message || j?.message || text;
    } catch {
      /* keep raw */
    }
    throw new Error(`BookStack HTTP ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
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
  const cfg = getBookstackConfig();
  if (!cfg) return { text: "Fehler: BookStack ist nicht konfiguriert." };

  const def = ALL_TOOLS.find((t) => t.name === name);
  if (!def) return { text: `Unbekanntes Tool: ${name}` };
  if (def.write && !writeEnabled)
    return {
      text: "Schreibzugriff ist deaktiviert. Diese Aktion (Erstellen/Ändern/Löschen) ist nicht erlaubt.",
    };

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
    return { text: `Fehler beim Tool ${name}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
