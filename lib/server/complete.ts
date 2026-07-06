import type { ProviderType } from "@/lib/types";

export interface CompleteOnceOpts {
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  /** reply token cap (default 64 — these are tiny utility calls). */
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * One-shot, NON-streaming completion for small server-side utility calls
 * (e.g. spellchecking a search term). Deterministic (temperature 0), short, and
 * time-boxed. Returns the assistant text (possibly ""); throws on transport /
 * HTTP errors so the caller can fall back gracefully.
 */
export async function completeOnce(o: CompleteOnceOpts): Promise<string> {
  const base = o.baseUrl.replace(/\/+$/, "");
  const maxTokens = o.maxTokens ?? 64;
  const signal = AbortSignal.timeout(o.timeoutMs ?? 12_000);

  if (o.type === "ollama") {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: o.model,
        messages: [
          { role: "system", content: o.system },
          { role: "user", content: o.user },
        ],
        stream: false,
        options: { temperature: 0, num_predict: maxTokens },
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const j = await res.json();
    return String(j?.message?.content ?? "").trim();
  }

  if (o.type === "anthropic") {
    const res = await fetch(`${base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": o.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: o.model,
        max_tokens: maxTokens,
        system: o.system,
        messages: [{ role: "user", content: o.user }],
        stream: false,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const j = await res.json();
    const parts = Array.isArray(j?.content) ? j.content : [];
    return parts.map((p: { text?: string }) => p?.text ?? "").join("").trim();
  }

  // OpenAI-compatible
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: o.model,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.user },
      ],
      stream: false,
      temperature: 0,
      max_tokens: maxTokens,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const j = await res.json();
  return String(j?.choices?.[0]?.message?.content ?? "").trim();
}
