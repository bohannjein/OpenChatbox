import { activeSearchProvider, type SearchProviderName } from "./config";

/**
 * Multi-provider web-search wrapper. The admin enables ONE (or more) providers
 * and stores their API keys (and optional endpoint override) server-side.
 * webSearch() picks the active provider and returns a normalized result list.
 * Response parsing is defensive: it accepts the common result shapes so schema
 * differences between providers/versions don't break retrieval. Keys stay on
 * the server.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 5;
const TIMEOUT_MS = 8000;

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
const trim = (u: string) => u.replace(/\/+$/, "");

/** Defensive normalizer — pulls results from the common JSON shapes. */
function normalize(j: unknown): SearchResult[] {
  const o = (j ?? {}) as Record<string, unknown>;
  const data = (o.data ?? {}) as Record<string, unknown>;
  const webPages = ((data.webPages ?? o.webPages ?? {}) as Record<string, unknown>).value;
  const arr = (
    (Array.isArray(o.results) && o.results) ||
    (Array.isArray(webPages) && webPages) ||
    (Array.isArray(data.results) && data.results) ||
    (Array.isArray(o.organic) && o.organic) ||
    (Array.isArray(o.items) && o.items) ||
    []
  ) as Record<string, unknown>[];
  return arr
    .map((v) => ({
      title: clean(v.title ?? v.name ?? v.heading),
      url: String(v.url ?? v.link ?? v.href ?? ""),
      snippet: clean(v.snippet ?? v.content ?? v.description ?? v.text ?? v.summary),
    }))
    .filter((r) => r.url)
    .slice(0, MAX_RESULTS);
}

async function bing(query: string, apiKey: string, baseUrl?: string): Promise<SearchResult[]> {
  const base = trim(baseUrl || "https://api.bing.microsoft.com/v7.0");
  const r = await timedFetch(
    `${base}/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}&responseFilter=Webpages`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey } }
  );
  if (!r.ok) throw new Error(`Bing HTTP ${r.status}`);
  return normalize(await r.json());
}

async function tavily(query: string, apiKey: string, baseUrl?: string): Promise<SearchResult[]> {
  const base = trim(baseUrl || "https://api.tavily.com");
  const r = await timedFetch(`${base}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: MAX_RESULTS, search_depth: "basic" }),
  });
  if (!r.ok) throw new Error(`Tavily HTTP ${r.status}`);
  return normalize(await r.json());
}

async function bocha(query: string, apiKey: string, baseUrl?: string): Promise<SearchResult[]> {
  const base = trim(baseUrl || "https://api.bochaai.com/v1");
  const r = await timedFetch(`${base}/web-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, count: MAX_RESULTS, summary: true }),
  });
  if (!r.ok) throw new Error(`Bocha HTTP ${r.status}`);
  return normalize(await r.json());
}

async function qureit(query: string, apiKey: string, baseUrl?: string): Promise<SearchResult[]> {
  const base = trim(baseUrl || "https://api.qureit.com/v1");
  const r = await timedFetch(`${base}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, count: MAX_RESULTS }),
  });
  if (!r.ok) throw new Error(`Qureit HTTP ${r.status}`);
  return normalize(await r.json());
}

const FETCHERS: Record<
  SearchProviderName,
  (q: string, k: string, b?: string) => Promise<SearchResult[]>
> = { bing, tavily, bocha, qureit };

/** Run a web search with the admin's active provider. Returns [] on any error. */
export async function webSearch(
  query: string
): Promise<{ provider: SearchProviderName | null; results: SearchResult[] }> {
  const active = activeSearchProvider();
  if (!active || !query.trim()) return { provider: null, results: [] };
  try {
    const results = await FETCHERS[active.name](query.trim(), active.apiKey, active.baseUrl);
    return { provider: active.name, results };
  } catch {
    return { provider: active.name, results: [] };
  }
}
