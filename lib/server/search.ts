import { activeSearchProvider, type SearchProviderName } from "./config";

/**
 * Multi-provider web-search wrapper. The admin enables ONE (or more) providers
 * and stores their API keys server-side (config.json → search). webSearch()
 * picks the active provider and returns a normalized result list. All keys stay
 * on the server; the client only ever sees results, never the key.
 *
 * Verified schemas: Bing Web Search v7, Tavily. Best-effort (Bing-compatible):
 * Bocha. Qureit is a best-effort generic integration — adjust the endpoint if
 * your account uses a different one.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 5;
const TIMEOUT_MS = 8000;

/** fetch with a hard timeout so a slow provider never hangs the chat. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 500);

// ── Bing Web Search v7 (also used by Bing "Free"/F1 tier) ────────────────────
async function bing(query: string, apiKey: string): Promise<SearchResult[]> {
  const u = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
    query
  )}&count=${MAX_RESULTS}&responseFilter=Webpages`;
  const r = await timedFetch(u, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
  if (!r.ok) throw new Error(`Bing HTTP ${r.status}`);
  const j = (await r.json()) as {
    webPages?: { value?: { name: string; url: string; snippet: string }[] };
  };
  return (j.webPages?.value ?? [])
    .slice(0, MAX_RESULTS)
    .map((v) => ({ title: clean(v.name), url: v.url, snippet: clean(v.snippet) }));
}

// ── Tavily (search API built for LLMs) ───────────────────────────────────────
async function tavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const r = await timedFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
    }),
  });
  if (!r.ok) throw new Error(`Tavily HTTP ${r.status}`);
  const j = (await r.json()) as {
    results?: { title: string; url: string; content: string }[];
  };
  return (j.results ?? [])
    .slice(0, MAX_RESULTS)
    .map((v) => ({ title: clean(v.title), url: v.url, snippet: clean(v.content) }));
}

// ── Bocha (博查) — Bing-compatible response shape ─────────────────────────────
async function bocha(query: string, apiKey: string): Promise<SearchResult[]> {
  const r = await timedFetch("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, count: MAX_RESULTS, summary: true }),
  });
  if (!r.ok) throw new Error(`Bocha HTTP ${r.status}`);
  const j = (await r.json()) as {
    data?: { webPages?: { value?: { name: string; url: string; snippet: string }[] } };
  };
  return (j.data?.webPages?.value ?? [])
    .slice(0, MAX_RESULTS)
    .map((v) => ({ title: clean(v.name), url: v.url, snippet: clean(v.snippet) }));
}

// ── Qureit — best-effort generic integration (unverified schema) ─────────────
async function qureit(query: string, apiKey: string): Promise<SearchResult[]> {
  const r = await timedFetch("https://api.qureit.com/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, count: MAX_RESULTS }),
  });
  if (!r.ok) throw new Error(`Qureit HTTP ${r.status}`);
  const j = (await r.json()) as {
    results?: Record<string, unknown>[];
    data?: { webPages?: { value?: Record<string, unknown>[] } };
  };
  const rows: Record<string, unknown>[] = j.results ?? j.data?.webPages?.value ?? [];
  return rows.slice(0, MAX_RESULTS).map((v) => ({
    title: clean(v.title ?? v.name),
    url: String(v.url ?? ""),
    snippet: clean(v.snippet ?? v.content),
  }));
}

const FETCHERS: Record<SearchProviderName, (q: string, k: string) => Promise<SearchResult[]>> = {
  bing,
  tavily,
  bocha,
  qureit,
};

/** Run a web search with the admin's active provider. Returns [] on any error. */
export async function webSearch(
  query: string
): Promise<{ provider: SearchProviderName | null; results: SearchResult[] }> {
  const active = activeSearchProvider();
  if (!active || !query.trim()) return { provider: null, results: [] };
  try {
    const results = await FETCHERS[active.name](query.trim(), active.apiKey);
    return { provider: active.name, results: results.filter((r) => r.url) };
  } catch {
    return { provider: active.name, results: [] };
  }
}
