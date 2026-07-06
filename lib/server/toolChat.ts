import { getBookstackConfig } from "./config";
import { toolDefs, runTool, toolLabel, type SourceLink } from "./bookstack";

/**
 * Agentic tool-calling loop for the BookStack integration. Runs the model with
 * the BookStack tools attached, executes any tool calls against the REST API,
 * feeds results back, and repeats until the model answers without a tool call.
 *
 * Output is the same NDJSON `{t,v}` stream the plain proxy emits, extended with:
 *   t:"c"    answer text delta        t:"r"    reasoning delta
 *   t:"tool" JSON {name,label,status} live status badge (running|done)
 *   t:"src"  JSON SourceLink[]        clickable BookStack sources
 *
 * Only Ollama and OpenAI-compatible providers support tool calling here.
 */

export interface ToolChatOpts {
  type: "ollama" | "openai";
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  keepAlive?: number | string;
  signal: AbortSignal;
}

interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  /** raw argument string (OpenAI) for faithful assistant-message replay */
  raw?: string;
}
interface RoundResult {
  content: string;
  toolCalls: ToolCall[];
}

const MAX_ROUNDS = 6;

const asObj = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

export function runToolChat(o: ToolChatOpts): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const cfg = getBookstackConfig();
  const writeEnabled = !!cfg?.writeEnabled;
  const defs = toolDefs(writeEnabled);
  const tools = defs.map((d) => ({
    type: "function",
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
  console.log(
    `[bookstack] Tool-Chat gestartet (${o.type}, Modell ${o.model}) — ${defs.length} Tools ` +
      `angehängt [${defs.map((d) => d.name).join(", ")}], writeEnabled=${writeEnabled}`
  );

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (t: string, v: string) =>
        controller.enqueue(enc.encode(JSON.stringify({ t, v }) + "\n"));

      const msgs: Record<string, unknown>[] = o.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const sources: SourceLink[] = [];
      const seen = new Set<string>();

      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const { content, toolCalls } =
            o.type === "ollama"
              ? await roundOllama(o, msgs, tools, send)
              : await roundOpenai(o, msgs, tools, send);

          if (!toolCalls.length) break; // model answered → done
          console.log(
            `[bookstack] Runde ${round + 1}: Modell fordert ${toolCalls.length} Tool-Call(s) an — ` +
              toolCalls.map((t) => t.name).join(", ")
          );

          // Replay the assistant's tool request, then each tool's result.
          msgs.push(assistantMsg(o.type, content, toolCalls));
          for (const tc of toolCalls) {
            send(
              "tool",
              JSON.stringify({ name: tc.name, label: toolLabel(tc.name, tc.args), status: "running" })
            );
            const res = await runTool(tc.name, tc.args, writeEnabled);
            for (const s of res.sources ?? [])
              if (s.url && !seen.has(s.url)) {
                seen.add(s.url);
                sources.push(s);
              }
            send(
              "tool",
              JSON.stringify({ name: tc.name, label: toolLabel(tc.name, tc.args), status: "done" })
            );
            msgs.push(toolResultMsg(o.type, tc, res.text));
          }

          if (round === MAX_ROUNDS - 1) {
            // Safety: force a final answer without another tool round.
            const final =
              o.type === "ollama"
                ? await roundOllama(o, msgs, [], send)
                : await roundOpenai(o, msgs, [], send);
            void final;
          }
        }
        if (sources.length) send("src", JSON.stringify(sources));
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          const msg = e instanceof Error ? e.message : String(e);
          send("c", `\n\n⚠️ Fehler: ${msg}`);
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ── Assistant / tool message shapes (provider-specific) ──────────────────────

function assistantMsg(
  type: "ollama" | "openai",
  content: string,
  tcs: ToolCall[]
): Record<string, unknown> {
  if (type === "ollama")
    return {
      role: "assistant",
      content,
      tool_calls: tcs.map((t) => ({ function: { name: t.name, arguments: t.args } })),
    };
  return {
    role: "assistant",
    content: content || "",
    tool_calls: tcs.map((t) => ({
      id: t.id,
      type: "function",
      function: { name: t.name, arguments: t.raw ?? JSON.stringify(t.args) },
    })),
  };
}

function toolResultMsg(
  type: "ollama" | "openai",
  tc: ToolCall,
  text: string
): Record<string, unknown> {
  return type === "ollama"
    ? { role: "tool", tool_name: tc.name, content: text }
    : { role: "tool", tool_call_id: tc.id, content: text };
}

// ── One streamed model round per provider ────────────────────────────────────

function splitLines(buf: string): [string[], string] {
  const lines = buf.split("\n");
  const rest = lines.pop() ?? "";
  return [lines, rest];
}

async function roundOllama(
  o: ToolChatOpts,
  msgs: Record<string, unknown>[],
  tools: unknown[],
  send: (t: string, v: string) => void
): Promise<RoundResult> {
  const res = await fetch(`${o.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: o.model,
      messages: msgs,
      stream: true,
      ...(tools.length ? { tools } : {}),
      ...(o.keepAlive !== undefined ? { keep_alive: o.keepAlive } : {}),
      options: {
        ...(o.temperature != null ? { temperature: o.temperature } : {}),
        ...(o.topP != null ? { top_p: o.topP } : {}),
        num_predict: o.maxTokens ?? 2048,
      },
    }),
    signal: o.signal,
  });
  if (!res.ok || !res.body) throw new Error(await upstreamError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  const calls: ToolCall[] = [];
  const handle = (s: string) => {
    if (!s) return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(s);
    } catch {
      return;
    }
    const m = (obj.message ?? {}) as Record<string, unknown>;
    if (typeof m.thinking === "string" && m.thinking) send("r", m.thinking);
    if (typeof m.content === "string" && m.content) {
      content += m.content;
      send("c", m.content);
    }
    const tc = m.tool_calls;
    if (Array.isArray(tc))
      for (const c of tc) {
        const fn = (c as { function?: { name?: string; arguments?: unknown } }).function;
        if (fn?.name) calls.push({ name: fn.name, args: asObj(fn.arguments) });
      }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const [lines, rest] = splitLines(buf);
    buf = rest;
    for (const l of lines) handle(l.trim());
  }
  handle(buf.trim());
  return { content, toolCalls: calls };
}

async function roundOpenai(
  o: ToolChatOpts,
  msgs: Record<string, unknown>[],
  tools: unknown[],
  send: (t: string, v: string) => void
): Promise<RoundResult> {
  const res = await fetch(`${o.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: o.model,
      messages: msgs,
      stream: true,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      ...(o.topP != null ? { top_p: o.topP } : {}),
      ...(o.maxTokens != null ? { max_tokens: o.maxTokens } : {}),
    }),
    signal: o.signal,
  });
  if (!res.ok || !res.body) throw new Error(await upstreamError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  // Assemble fragmented tool_calls by index.
  const acc = new Map<number, { id?: string; name: string; args: string }>();
  const handle = (line: string) => {
    const s = line.trim();
    if (!s.startsWith("data:")) return;
    const payload = s.slice(5).trim();
    if (payload === "[DONE]") return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(payload);
    } catch {
      return;
    }
    const choice = (obj.choices as Array<{ delta?: Record<string, unknown> }>)?.[0];
    const delta = choice?.delta ?? {};
    const reason = delta.reasoning_content ?? delta.reasoning;
    if (typeof reason === "string" && reason) send("r", reason);
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      send("c", delta.content);
    }
    const tcs = delta.tool_calls as
      | Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
      | undefined;
    if (Array.isArray(tcs))
      for (const frag of tcs) {
        const i = frag.index ?? 0;
        const cur = acc.get(i) ?? { name: "", args: "" };
        if (frag.id) cur.id = frag.id;
        if (frag.function?.name) cur.name = frag.function.name;
        if (frag.function?.arguments) cur.args += frag.function.arguments;
        acc.set(i, cur);
      }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const [lines, rest] = splitLines(buf);
    buf = rest;
    for (const l of lines) handle(l);
  }
  handle(buf);
  const toolCalls: ToolCall[] = [...acc.values()]
    .filter((c) => c.name)
    .map((c) => ({ id: c.id, name: c.name, args: asObj(c.args), raw: c.args || "{}" }));
  return { content, toolCalls };
}

async function upstreamError(res: Response): Promise<string> {
  const detail = await res.text().catch(() => "");
  let msg = detail;
  try {
    const j = JSON.parse(detail);
    msg = j?.error?.message || j?.error || j?.message || detail;
    if (typeof msg !== "string") msg = JSON.stringify(msg);
  } catch {
    /* raw */
  }
  return `Provider-Fehler (HTTP ${res.status}): ${msg}`.trim();
}
