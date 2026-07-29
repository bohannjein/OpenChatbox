import { NextRequest } from "next/server";
import { authenticateAssistant, checkLimits, isFailure } from "@/lib/server/apiAuth";
import { corsHeaders, preflight } from "@/lib/server/apiCors";
import { bumpUsage } from "@/lib/server/assistants";
import { AssistantError, runAssistantChat, type AssistantTurn } from "@/lib/server/assistantChat";
import { touchAssistant } from "@/lib/server/presence";
import type { SourceLink } from "@/lib/server/bookstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public chat endpoint for embedded assistants, shaped like OpenAI's
 * /v1/chat/completions so existing SDKs and example code work unchanged.
 *
 * What differs from OpenAI on purpose:
 *  - `model` in the body is IGNORED. The assistant's model is pinned server-side;
 *    letting the caller pick would defeat the whole point of the feature.
 *  - reasoning deltas are sent as `delta.reasoning_content` (the DeepSeek
 *    convention) — clients that don't know it simply ignore the field.
 *  - when the assistant has "show sources" on, the final chunk carries a
 *    non-standard `x_sources` array.
 */

const enc = new TextEncoder();
const sse = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function chunk(id: string, model: string, created: number, delta: Record<string, unknown>) {
  return {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: null }],
  };
}

/** OpenAI-shaped error envelope. */
function fail(status: number, message: string, headers: Record<string, string>) {
  return Response.json(
    { error: { message, type: status === 429 ? "rate_limit_error" : "invalid_request_error" } },
    { status, headers }
  );
}

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin") ?? "");

  const caller = authenticateAssistant(req);
  if (isFailure(caller)) return fail(caller.status, caller.error, cors);

  const limited = checkLimits(caller);
  if (limited)
    return fail(limited.status, limited.error, {
      ...cors,
      ...(limited.retryAfter ? { "Retry-After": String(limited.retryAfter) } : {}),
    });

  const body = (await req.json().catch(() => ({}))) as {
    messages?: unknown;
    stream?: unknown;
  };
  const turns: AssistantTurn[] = Array.isArray(body.messages)
    ? (body.messages as unknown[])
        .map((m): AssistantTurn => {
          const o = (m ?? {}) as { role?: unknown; content?: unknown };
          const role: AssistantTurn["role"] =
            o.role === "assistant" ? "assistant" : o.role === "system" ? "system" : "user";
          return { role, content: typeof o.content === "string" ? o.content : "" };
        })
        .filter((m) => m.content)
    : [];

  const { assistant, key } = caller;
  touchAssistant(assistant.id, assistant.name, req);

  let run;
  try {
    run = await runAssistantChat(assistant, turns, req.signal);
  } catch (e) {
    if (e instanceof AssistantError) return fail(e.status, e.message, cors);
    return fail(502, e instanceof Error ? e.message : "Fehler.", cors);
  }

  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const inChars = turns.reduce((n, m) => n + m.content.length, 0);
  const sources: SourceLink[] = assistant.showSources ? run.sources : [];
  const wantsStream = body.stream !== false;

  // ── Non-streaming: collect, then answer with one completion object ────────
  if (!wantsStream) {
    let text = "";
    const reader = run.stream.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.trim()) continue;
        try {
          const ev = JSON.parse(l) as { t: string; v: string };
          if (ev.t === "c") text += ev.v;
        } catch {
          /* ignore partial */
        }
      }
    }
    bumpUsage(assistant.id, {
      requests: 1,
      inChars,
      outChars: text.length,
      keyId: key.id,
    });
    return Response.json(
      {
        id,
        object: "chat.completion",
        created,
        model: run.model,
        choices: [
          { index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" },
        ],
        ...(sources.length ? { x_sources: sources } : {}),
      },
      { headers: cors }
    );
  }

  // ── Streaming: translate our {t,v} events into OpenAI chunks ──────────────
  let outChars = 0;
  const out = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const reader = run.stream.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        ctrl.enqueue(sse(chunk(id, run.model, created, { role: "assistant", content: "" })));
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            let ev: { t: string; v: string };
            try {
              ev = JSON.parse(l);
            } catch {
              continue;
            }
            if (ev.t === "c") {
              outChars += ev.v.length;
              ctrl.enqueue(sse(chunk(id, run.model, created, { content: ev.v })));
            } else if (ev.t === "r") {
              ctrl.enqueue(sse(chunk(id, run.model, created, { reasoning_content: ev.v })));
            }
          }
        }
        const last = chunk(id, run.model, created, {});
        last.choices[0].finish_reason = "stop" as unknown as null;
        ctrl.enqueue(sse(sources.length ? { ...last, x_sources: sources } : last));
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (e) {
        // Mid-stream failures can't become an HTTP status any more — surface them
        // as content so the visitor sees something rather than a silent stop.
        const msg = e instanceof Error ? e.message : String(e);
        ctrl.enqueue(sse(chunk(id, run.model, created, { content: `\n\n[Fehler: ${msg}]` })));
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      } finally {
        bumpUsage(assistant.id, { requests: 1, inChars, outChars, keyId: key.id });
        ctrl.close();
      }
    },
  });

  return new Response(out, { headers: { ...SSE_HEADERS, ...cors } });
}
