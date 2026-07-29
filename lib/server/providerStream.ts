import { stripPrefix, mimeOf } from "./http";
import type { ProviderType } from "@/lib/types";

/**
 * One place that knows how to talk to a model provider and how to normalize its
 * stream. Extracted from app/api/chat/route.ts so the internal chat route and the
 * public assistant API share exactly one implementation of each provider's
 * quirks — two copies would drift, and the quirks (Ollama's num_ctx, Anthropic's
 * top-level system, the three different reasoning field names) are the part that
 * is expensive to rediscover.
 *
 * Output is always the same NDJSON-ready event stream: `{t:"c"|"r", v}` — answer
 * text and reasoning text. Callers decide how to frame it (NDJSON internally,
 * SSE for the public API).
 */

/** Ollama context window (tokens). Its built-in default is only 2048, which
 *  silently truncates older turns → the model "forgets". Env-tunable per host VRAM. */
export const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 8192;

export interface StreamMessage {
  role: string;
  content: string;
  /** data-URL images (vision) */
  images?: string[];
}

export interface ProviderCall {
  type: ProviderType | undefined;
  /** without trailing slash */
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: StreamMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Ollama only: number (seconds, -1 = forever) or a duration string */
  keepAlive?: number | string;
  signal?: AbortSignal;
}

/** Token budget for the history window — Ollama is bounded by num_ctx. */
export function tokenBudgetFor(type: ProviderType | undefined, maxTokens?: number): number {
  const replyReserve = (maxTokens ?? 2048) + 512;
  return type === "ollama" ? Math.max(1024, NUM_CTX - replyReserve) : 24_000;
}

/**
 * Coerce a client-sent keepAlive to what Ollama expects: numeric strings
 * ("-1","0") must become numbers (Ollama parses a *string* as a Go duration, so
 * "-1" would fail). -1 = keep the model resident forever.
 */
export function normalizeKeepAlive(raw?: string | number | null): number | string | undefined {
  const v = raw ?? process.env.OLLAMA_KEEP_ALIVE;
  if (v == null || v === "") return undefined;
  return /^-?\d+$/.test(String(v)) ? Number(v) : (v as string);
}

const hasImg = (m: StreamMessage) => Array.isArray(m.images) && m.images.length > 0;

/** Build the upstream request (URL + fetch init) for one provider. */
export function buildProviderRequest(c: ProviderCall): { url: string; init: RequestInit } {
  const { type, baseUrl, apiKey, model, messages, temperature, topP, maxTokens } = c;

  if (type === "ollama") {
    // Ollama vision: `images` = raw base64 (no data-URL prefix).
    const msgs = messages.map((m) =>
      hasImg(m)
        ? { role: m.role, content: m.content, images: m.images!.map(stripPrefix) }
        : { role: m.role, content: m.content }
    );
    return {
      url: `${baseUrl}/api/chat`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: msgs,
          stream: true,
          // keep_alive: -1 hält das Modell dauerhaft im RAM (Cache), sonst
          // Dauer wie "2m"; weglassen → Ollama-Default.
          ...(c.keepAlive !== undefined ? { keep_alive: c.keepAlive } : {}),
          options: {
            ...(temperature != null ? { temperature } : {}),
            ...(topP != null ? { top_p: topP } : {}),
            // Kontextfenster (Default 2048 ist zu klein → Kontextverlust).
            num_ctx: NUM_CTX,
            // harte Obergrenze, damit ein Request nicht endlos VRAM/Compute hält
            num_predict: maxTokens ?? 2048,
          },
        }),
        signal: c.signal,
      },
    };
  }

  if (type === "anthropic") {
    // Anthropic: system als Top-Level-Param, messages nur user/assistant.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const msgs = messages
      .filter((m) => m.role !== "system")
      .map((m) =>
        hasImg(m)
          ? {
              role: m.role,
              content: [
                { type: "text", text: m.content },
                ...m.images!.map((u) => ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeOf(u, "image/png"),
                    data: stripPrefix(u),
                  },
                })),
              ],
            }
          : { role: m.role, content: m.content }
      );
    return {
      url: `${baseUrl}/messages`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens ?? 4096,
          stream: true,
          ...(temperature != null ? { temperature } : {}),
          ...(topP != null ? { top_p: topP } : {}),
          ...(system ? { system } : {}),
          messages: msgs,
        }),
        signal: c.signal,
      },
    };
  }

  // OpenAI vision: content becomes an array of text + image_url parts.
  const msgs = messages.map((m) =>
    hasImg(m)
      ? {
          role: m.role,
          content: [
            { type: "text", text: m.content },
            ...m.images!.map((u) => ({ type: "image_url", image_url: { url: u } })),
          ],
        }
      : { role: m.role, content: m.content }
  );
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: msgs,
        stream: true,
        ...(temperature != null ? { temperature } : {}),
        ...(topP != null ? { top_p: topP } : {}),
        ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
      }),
    signal: c.signal,
    },
  };
}

/** A failed upstream call, already translated into a user-facing message. */
export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/**
 * Call the provider and return a normalized `{t,v}` NDJSON-line stream.
 * Throws ProviderError with a translated message when the call or the HTTP
 * status fails, so both routes surface identical wording.
 */
export async function streamProvider(c: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  const { url, init } = buildProviderRequest(c);

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ProviderError(`Verbindung fehlgeschlagen: ${msg}`);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    // Unwrap the provider's JSON error so we don't surface nested {"error":"{...}"}.
    let msg = detail;
    try {
      const j = JSON.parse(detail);
      msg = j?.error?.message || j?.error || j?.message || detail;
      if (typeof msg !== "string") msg = JSON.stringify(msg);
    } catch {
      /* not JSON — keep raw text */
    }
    throw new ProviderError(`Provider-Fehler (HTTP ${upstream.status}): ${msg}`.trim());
  }

  const transform =
    c.type === "ollama"
      ? ollamaTransform()
      : c.type === "anthropic"
      ? anthropicTransform()
      : openaiTransform();
  return upstream.body.pipeThrough(transform);
}

/**
 * Coerce a streamed content field to answer text. Providers sometimes send
 * `content` as an array of parts (e.g. [{type:"text",text:"..."}]) or an object
 * instead of a plain string — encoding those directly yields "[object Object]".
 * Reasoning/thinking parts are excluded here (handled by asReasoning).
 */
export function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const o = p as { type?: string; text?: unknown };
          if (o.type === "thinking") return "";
          if ("text" in o) return String(o.text ?? "");
        }
        return "";
      })
      .join("");
  if (v && typeof v === "object" && "text" in v)
    return String((v as { text?: unknown }).text ?? "");
  return "";
}

/** Extract reasoning/thinking text from a content field (array of parts). */
export function asReasoning(v: unknown): string {
  if (Array.isArray(v))
    return v
      .map((p) => {
        if (p && typeof p === "object") {
          const o = p as { type?: string; thinking?: unknown };
          if (o.type === "thinking") return String(o.thinking ?? "");
        }
        return "";
      })
      .join("");
  return "";
}

/** Encode one NDJSON stream event: content ("c") or reasoning ("r"). */
const encoder = new TextEncoder();
function evt(t: "c" | "r", v: string): Uint8Array {
  return encoder.encode(JSON.stringify({ t, v }) + "\n");
}

/** Split a raw text buffer into complete lines; returns [lines, rest]. */
function splitLines(buf: string): [string[], string] {
  const lines = buf.split("\n");
  const rest = lines.pop() ?? "";
  return [lines, rest];
}

/** Ollama NDJSON: message.content → "c", message.thinking → "r". */
function ollamaTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buf = "";
  const handle = (s: string, ctrl: TransformStreamDefaultController) => {
    if (!s) return;
    try {
      const obj = JSON.parse(s);
      const think = asText(obj?.message?.thinking);
      if (think) ctrl.enqueue(evt("r", think));
      const piece = asText(obj?.message?.content ?? obj?.response);
      if (piece) ctrl.enqueue(evt("c", piece));
    } catch {
      /* ignore partial */
    }
  };
  return new TransformStream({
    transform(chunk, ctrl) {
      buf += decoder.decode(chunk, { stream: true });
      const [lines, rest] = splitLines(buf);
      buf = rest;
      for (const line of lines) handle(line.trim(), ctrl);
    },
    flush(ctrl) {
      handle(buf.trim(), ctrl);
    },
  });
}

/** Anthropic SSE: text_delta → "c", thinking_delta → "r". */
function anthropicTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buf = "";
  return new TransformStream({
    transform(chunk, ctrl) {
      buf += decoder.decode(chunk, { stream: true });
      const [lines, rest] = splitLines(buf);
      buf = rest;
      for (const line of lines) {
        const s = line.trim();
        if (!s || !s.startsWith("data:")) continue;
        try {
          const obj = JSON.parse(s.slice(5).trim());
          if (obj?.type !== "content_block_delta") continue;
          const d = obj.delta ?? {};
          if (typeof d.text === "string" && d.text) ctrl.enqueue(evt("c", d.text));
          if (typeof d.thinking === "string" && d.thinking)
            ctrl.enqueue(evt("r", d.thinking));
        } catch {
          /* ignore */
        }
      }
    },
  });
}

/**
 * OpenAI SSE: delta.content → "c". Reasoning from delta.reasoning_content
 * (DeepSeek), delta.reasoning, or content-array "thinking" parts (Magistral).
 */
function openaiTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buf = "";
  return new TransformStream({
    transform(chunk, ctrl) {
      buf += decoder.decode(chunk, { stream: true });
      const [lines, rest] = splitLines(buf);
      buf = rest;
      for (const line of lines) {
        const s = line.trim();
        if (!s || !s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          const delta = obj?.choices?.[0]?.delta ?? {};
          const reason =
            asText(delta.reasoning_content) ||
            asText(delta.reasoning) ||
            asReasoning(delta.content);
          if (reason) ctrl.enqueue(evt("r", reason));
          const piece = asText(delta.content);
          if (piece) ctrl.enqueue(evt("c", piece));
        } catch {
          /* ignore */
        }
      }
    },
  });
}
