import { NextRequest } from "next/server";
import type { ChatRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const baseUrl = (body.baseUrl || "").replace(/\/+$/, "");
  const { type, model, messages, apiKey, params } = body;
  if (!baseUrl || !model || !messages)
    return new Response("baseUrl, model und messages erforderlich", {
      status: 400,
    });

  const temperature = params?.temperature;
  const topP = params?.topP;
  const maxTokens = params?.maxTokens;

  const stripPrefix = (u: string) => {
    const i = u.indexOf("base64,");
    return i >= 0 ? u.slice(i + 7) : u;
  };
  const mimeOf = (u: string) => {
    const m = /^data:([^;]+);/.exec(u);
    return m ? m[1] : "image/png";
  };
  const hasImg = (m: (typeof messages)[number]) =>
    Array.isArray(m.images) && m.images.length > 0;

  // Build upstream request per provider.
  let upstream: Response;
  try {
    if (type === "ollama") {
      // Ollama vision: `images` = raw base64 (no data-URL prefix).
      const msgs = messages.map((m) =>
        hasImg(m)
          ? {
              role: m.role,
              content: m.content,
              images: m.images!.map(stripPrefix),
            }
          : { role: m.role, content: m.content }
      );
      upstream = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: msgs,
          stream: true,
          options: {
            ...(temperature != null ? { temperature } : {}),
            ...(topP != null ? { top_p: topP } : {}),
            ...(maxTokens != null ? { num_predict: maxTokens } : {}),
          },
        }),
        signal: req.signal,
      });
    } else if (type === "anthropic") {
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
                      media_type: mimeOf(u),
                      data: stripPrefix(u),
                    },
                  })),
                ],
              }
            : { role: m.role, content: m.content }
        );
      upstream = await fetch(`${baseUrl}/messages`, {
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
        signal: req.signal,
      });
    } else {
      // OpenAI vision: content becomes an array of text + image_url parts.
      const msgs = messages.map((m) =>
        hasImg(m)
          ? {
              role: m.role,
              content: [
                { type: "text", text: m.content },
                ...m.images!.map((u) => ({
                  type: "image_url",
                  image_url: { url: u },
                })),
              ],
            }
          : { role: m.role, content: m.content }
      );
      upstream = await fetch(`${baseUrl}/chat/completions`, {
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
        signal: req.signal,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Verbindung fehlgeschlagen: ${msg}`, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      `Provider-Fehler (HTTP ${upstream.status}) ${detail}`.trim(),
      { status: 502 }
    );
  }

  const transform =
    type === "ollama"
      ? ollamaTransform()
      : type === "anthropic"
      ? anthropicTransform()
      : openaiTransform();
  const stream = upstream.body.pipeThrough(transform);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Coerce a streamed content field to answer text. Providers sometimes send
 * `content` as an array of parts (e.g. [{type:"text",text:"..."}]) or an object
 * instead of a plain string — encoding those directly yields "[object Object]".
 * Reasoning/thinking parts are excluded here (handled by asReasoning).
 */
function asText(v: unknown): string {
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
function asReasoning(v: unknown): string {
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
function evt(t: "c" | "r", v: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ t, v }) + "\n");
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
