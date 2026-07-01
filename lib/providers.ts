import type {
  ChatRequest,
  ModelOption,
  Provider,
  ProviderRequest,
} from "./types";

export const modelKey = (providerId: string, model: string) =>
  `${providerId}::${model}`;

export const parseModelKey = (key: string) => {
  const idx = key.indexOf("::");
  return { providerId: key.slice(0, idx), model: key.slice(idx + 2) };
};

/** Normalize a base url (strip trailing slash). */
export const normUrl = (u: string) => u.trim().replace(/\/+$/, "");

/** Fetch available models for one provider via our proxy route. */
export async function fetchModels(p: Provider): Promise<string[]> {
  const body: ProviderRequest = {
    type: p.type,
    baseUrl: normUrl(p.baseUrl),
    apiKey: p.apiKey,
  };
  const res = await fetch("/api/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { models: string[] };
  return data.models ?? [];
}

/** Build the flat list of model options across all enabled providers. */
export async function loadAllModels(
  providers: Provider[]
): Promise<{ options: ModelOption[]; errors: Record<string, string> }> {
  const options: ModelOption[] = [];
  const errors: Record<string, string> = {};
  await Promise.all(
    providers
      .filter((p) => p.enabled)
      .map(async (p) => {
        const manual = (p.manualModels ?? []).filter(Boolean);
        let fetched: string[] = [];
        try {
          fetched = await fetchModels(p);
        } catch (e) {
          // Manuelle Modelle als Fallback — kein Fehler, wenn vorhanden.
          if (manual.length === 0)
            errors[p.id] = e instanceof Error ? e.message : String(e);
        }
        // Merge + dedupe (manuelle zuerst).
        const seen = new Set<string>();
        for (const m of [...manual, ...fetched]) {
          if (seen.has(m)) continue;
          seen.add(m);
          options.push({
            key: modelKey(p.id, m),
            providerId: p.id,
            providerName: p.name,
            providerType: p.type,
            model: m,
          });
        }
      })
  );
  return { options, errors };
}

/** One streamed event: content ("c") or reasoning ("r") text delta. */
export type StreamEvent = { t: "c" | "r"; v: string };

/**
 * Stream a chat completion. The proxy route normalizes Ollama NDJSON /
 * OpenAI SSE / Anthropic SSE into a single NDJSON stream of {t,v} events,
 * splitting answer text ("c") from reasoning/thinking output ("r").
 * Pass an AbortSignal to stop generation.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (type: "c" | "r", text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, baseUrl: normUrl(req.baseUrl) }),
    signal,
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const flush = (final = false) => {
    const lines = buf.split("\n");
    buf = final ? "" : lines.pop() ?? "";
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      try {
        const evt = JSON.parse(s) as StreamEvent;
        if (evt && (evt.t === "c" || evt.t === "r") && evt.v)
          onEvent(evt.t, evt.v);
      } catch {
        /* ignore partial */
      }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    flush();
  }
  flush(true);
}
