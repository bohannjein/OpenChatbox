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

/** Friendly display name: alias if set, else raw model id. */
export const displayName = (
  aliases: Record<string, string>,
  key: string,
  model: string
) => (aliases[key] && aliases[key].trim()) || model;

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

/**
 * Ask an Ollama server to unload a model from memory (free VRAM/RAM).
 * Fire-and-forget; errors are ignored. Only meaningful for Ollama.
 */
export function unloadModel(baseUrl: string, model: string): void {
  fetch("/api/unload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: normUrl(baseUrl), model }),
  }).catch(() => {});
}

/**
 * Find a code block worth showing in the splitscreen: the last fenced block
 * (```lang ... ```), open or closed, with at least `threshold` lines.
 */
export function detectCodeBlock(
  text: string,
  threshold: number
): { lang: string; code: string; open: boolean } | null {
  const parts = text.split("```");
  let best: { lang: string; code: string; open: boolean } | null = null;
  for (let i = 1; i < parts.length; i += 2) {
    const block = parts[i];
    const nl = block.indexOf("\n");
    const lang = (nl >= 0 ? block.slice(0, nl) : "").trim();
    const raw = nl >= 0 ? block.slice(nl + 1) : block;
    const code = raw.replace(/\n$/, "");
    const open = i === parts.length - 1 && parts.length % 2 === 0;
    const lines = code.split("\n").length;
    if (lines >= threshold) best = { lang: lang || "text", code, open };
  }
  return best;
}

/** All fenced code blocks in a text (closed only). */
export function listCodeBlocks(
  text: string
): { lang: string; code: string }[] {
  const parts = text.split("```");
  const out: { lang: string; code: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    // odd index at the very end = unclosed block → skip
    if (i === parts.length - 1) break;
    const block = parts[i];
    const nl = block.indexOf("\n");
    const lang = (nl >= 0 ? block.slice(0, nl) : "").trim();
    const code = (nl >= 0 ? block.slice(nl + 1) : block).replace(/\n$/, "");
    if (code.trim()) out.push({ lang: lang || "text", code });
  }
  return out;
}

/** Map a code language to a file extension. */
export function langToExt(lang: string): string {
  const m: Record<string, string> = {
    javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx",
    jsx: "jsx", python: "py", py: "py", java: "java", c: "c", cpp: "cpp",
    csharp: "cs", cs: "cs", go: "go", rust: "rs", rb: "rb", ruby: "rb",
    php: "php", sh: "sh", bash: "sh", sql: "sql", json: "json", yaml: "yaml",
    yml: "yml", html: "html", css: "css", md: "md", markdown: "md",
  };
  return m[lang.toLowerCase()] || "txt";
}

export interface PullProgress {
  status: string;
  percent: number | null; // 0..100, null when unknown
  done: boolean;
}

/**
 * Pull an Ollama model, streaming live progress. Calls /api/pull which
 * forwards to the Ollama server's /api/pull NDJSON stream.
 */
export async function pullModel(
  baseUrl: string,
  model: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: normUrl(baseUrl), model }),
    signal,
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const handle = (line: string) => {
    const s = line.trim();
    if (!s) return;
    try {
      const o = JSON.parse(s) as {
        status?: string;
        total?: number;
        completed?: number;
        error?: string;
      };
      if (o.error) throw new Error(o.error);
      const percent =
        o.total && o.completed != null
          ? Math.round((o.completed / o.total) * 100)
          : null;
      const done = (o.status ?? "").toLowerCase() === "success";
      onProgress({ status: o.status ?? "", percent, done });
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) handle(l);
  }
  if (buf.trim()) handle(buf);
}

/**
 * Ask the model to extract durable facts about the user from a message.
 * Returns short fact strings (or [] if none). Best-effort; never throws.
 */
export async function extractMemory(
  base: {
    type: ChatRequest["type"];
    baseUrl: string;
    apiKey?: string;
    model: string;
  },
  userText: string,
  existing: string[]
): Promise<string[]> {
  const sys =
    "Du extrahierst DAUERHAFTE Fakten über den Nutzer aus seiner Nachricht " +
    "(Rolle, Beruf, Abteilung, bevorzugte Sprachen/Tools, Vorlieben, Kontext). " +
    "Ignoriere einmalige Fragen oder Aufgaben. Gib AUSSCHLIESSLICH ein JSON-Array " +
    "kurzer deutscher Faktensätze zurück, die noch NICHT bekannt sind. " +
    "Wenn nichts Dauerhaftes vorliegt: []. Nur JSON, kein weiterer Text.";
  const user =
    `Bekannte Fakten: ${JSON.stringify(existing)}\n\nNachricht: ${userText}`;

  let acc = "";
  try {
    await streamChat(
      {
        type: base.type,
        baseUrl: base.baseUrl,
        apiKey: base.apiKey,
        model: base.model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        params: { temperature: 0, topP: 1, maxTokens: 300 },
      },
      (t, text) => {
        if (t === "c") acc += text;
      }
    );
  } catch {
    return [];
  }
  try {
    const m = acc.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => typeof x === "string")
      .map((x: string) => x.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Normalize a model's title reply → max 4 words, no quotes/punctuation/prefix. */
function sanitizeTitle(raw: string): string {
  let t = (raw || "").trim().split("\n")[0].trim();
  t = t.replace(/^(titel|title)\s*[:\-–]\s*/i, ""); // drop "Titel:" prefix
  t = t.replace(/^["'«»„“”]+|["'«»„“”.…]+$/g, "").trim(); // strip wrapping quotes / trailing dot
  t = t.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  return t.length > 48 ? t.slice(0, 48).trim() : t;
}

/**
 * Ask the model for a concise (<=4 word) chat title from the transcript.
 * Non-streaming (accumulates the stream). Returns "" on failure/empty.
 */
export async function generateTitle(
  base: {
    type: ChatRequest["type"];
    baseUrl: string;
    apiKey?: string;
    model: string;
  },
  transcript: string
): Promise<string> {
  const sys =
    "Generiere aus dem folgenden Chatverlauf einen prägnanten Titel aus " +
    "MAXIMAL 4 Wörtern. Keine Anführungszeichen, kein Punkt, keine Emojis, " +
    "kein Präfix. Antworte NUR mit dem Titel, in der Sprache des Gesprächs.";
  let acc = "";
  try {
    await streamChat(
      {
        type: base.type,
        baseUrl: base.baseUrl,
        apiKey: base.apiKey,
        model: base.model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Chatverlauf:\n${transcript}\n\nTitel:` },
        ],
        params: { temperature: 0.3, topP: 1, maxTokens: 24 },
      },
      (t, text) => {
        if (t === "c") acc += text;
      }
    );
  } catch {
    return "";
  }
  return sanitizeTitle(acc);
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
    const raw = await res.text().catch(() => "");
    let msg = raw;
    try {
      const j = JSON.parse(raw);
      if (j && typeof j.error === "string") msg = j.error;
    } catch {
      /* not JSON — use raw text */
    }
    throw new Error(msg || res.statusText || `HTTP ${res.status}`);
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
