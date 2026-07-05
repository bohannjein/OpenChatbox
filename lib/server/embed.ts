import { getConfig, getProviders } from "./config";

/**
 * Local text embeddings via Ollama. Uses the admin's first Ollama provider
 * (falling back to primaryProvider / env / localhost) and the configured
 * embedding model (default nomic-embed-text). Server-side only.
 */
export function embeddingModel(): string {
  return (
    getConfig().embeddingModel?.trim() ||
    process.env.OLLAMA_EMBED_MODEL ||
    "nomic-embed-text"
  );
}

function ollamaBaseUrl(): string {
  const p = getProviders().find((x) => x.type === "ollama" && x.baseUrl);
  const primary = getConfig().primaryProvider;
  const base =
    p?.baseUrl ||
    (primary?.type === "ollama" ? primary.baseUrl : "") ||
    process.env.OLLAMA_BASE_URL ||
    "http://localhost:11434";
  return base.replace(/\/+$/, "");
}

/**
 * Embed one or more texts. Uses Ollama /api/embed (batch); falls back to the
 * legacy /api/embeddings per-item if the batch endpoint is unavailable.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const base = ollamaBaseUrl();
  const model = embeddingModel();

  const r = await fetch(`${base}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (r.ok) {
    const j = (await r.json()) as { embeddings?: number[][] };
    if (Array.isArray(j.embeddings) && j.embeddings.length === texts.length)
      return j.embeddings;
  }

  // Legacy fallback: /api/embeddings takes a single prompt.
  const out: number[][] = [];
  for (const text of texts) {
    const res = await fetch(`${base}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok)
      throw new Error(
        `Embedding fehlgeschlagen (HTTP ${res.status}). Modell „${model}" auf dem Ollama-Server gepullt?`
      );
    const j = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(j.embedding)) throw new Error("Ungültige Embedding-Antwort.");
    out.push(j.embedding);
  }
  return out;
}

/** Embed a single query string. */
export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0] ?? [];
}
