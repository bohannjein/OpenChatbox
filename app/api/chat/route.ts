import { NextRequest } from "next/server";
import type { ChatRequest } from "@/lib/types";
import {
  getProviderById,
  getBookstackConfig,
  getGuestConfig,
  isKnownProviderBaseUrl,
} from "@/lib/server/config";
import { getUserOrGuest } from "@/lib/server/adminAuth";
import { parseModelKey } from "@/lib/providers";
import { runToolChat } from "@/lib/server/toolChat";
import { NDJSON_HEADERS } from "@/lib/server/http";
import { applyContextWindow } from "@/lib/server/context";
import {
  NUM_CTX,
  ProviderError,
  normalizeKeepAlive,
  streamProvider,
  tokenBudgetFor,
} from "@/lib/server/providerStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard cap on non-system turns kept regardless of token budget.
const MAX_HISTORY_MESSAGES = 20;

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Ungültiger Request-Body (kein gültiges JSON)." },
      { status: 400 }
    );
  }

  // Authenticate. The middleware only checks that SOME session cookie exists
  // (middleware.ts) — the signature is verified here. Two kinds of caller are
  // allowed: a stored user with a real session, or a guest ticket.
  const caller = getUserOrGuest(req);
  if (!caller) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { user, isGuest } = caller;

  // Guests may ONLY use the admin-pinned guest model — hard-override the
  // provider + model (ignoring anything the client asked for) and disable tools,
  // so an unauthenticated visitor can't spend budget on other/bigger models.
  let guestModel: string | undefined;
  if (isGuest) {
    const g = getGuestConfig();
    if (!g.enabled || !g.model)
      return Response.json({ error: "Gast-Zugang ist nicht aktiviert." }, { status: 403 });
    const gm = parseModelKey(g.model);
    guestModel = gm.model;
    body.providerId = gm.providerId;
    body.tools = false;
  }

  // Resolve the provider: when a providerId is given, use the server-stored
  // provider (incl. its secret apiKey) so the key never lives in the client;
  // otherwise fall back to the client-sent baseUrl/type/apiKey. Guests must
  // always resolve to a server-registered provider (no client-supplied endpoint).
  const resolved = body.providerId ? getProviderById(body.providerId) : undefined;
  if (isGuest && !resolved)
    return Response.json({ error: "Gast-Modell ist nicht verfügbar." }, { status: 503 });
  const type = resolved?.type ?? body.type;
  const baseUrl = (resolved?.baseUrl ?? body.baseUrl ?? "").replace(/\/+$/, "");
  const apiKey = resolved?.apiKey ?? body.apiKey;
  const { messages, params } = body;
  const model = isGuest ? guestModel! : body.model;
  if (!baseUrl || !model || !messages)
    return Response.json(
      { error: "baseUrl, model und messages erforderlich." },
      { status: 400 }
    );
  // Don't let a client-named endpoint turn this route into a fetch proxy.
  if (!resolved && user?.role !== "admin" && !isKnownProviderBaseUrl(baseUrl))
    return Response.json(
      { error: "Unbekannter Anbieter. Bitte einen registrierten Anbieter wählen." },
      { status: 400 }
    );

  const temperature = params?.temperature;
  const topP = params?.topP;
  const maxTokens = params?.maxTokens;
  const keepAlive = normalizeKeepAlive(body.keepAlive);

  // Sliding-window context filter: always keep the leading system prompt, then
  // the most recent turns that fit the model's window. This continues the
  // conversation instead of silently forgetting it.
  const windowed = applyContextWindow(messages, {
    maxMessages: MAX_HISTORY_MESSAGES,
    maxTokens: tokenBudgetFor(type, maxTokens),
  });

  // BookStack tool-calling: when the client opts in (tools:true), the admin has
  // enabled the integration, and the provider supports function calling, run the
  // agentic tool loop instead of the plain streaming proxy. Emits the same NDJSON
  // {t,v} stream plus t:"tool"/"src" events for the live badge + source links.
  if (body.tools && (type === "ollama" || type === "openai") && getBookstackConfig()) {
    const stream = runToolChat({
      type,
      baseUrl,
      apiKey,
      model,
      messages: windowed.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      topP,
      maxTokens,
      numCtx: NUM_CTX,
      keepAlive,
      signal: req.signal,
    });
    return new Response(stream, { headers: NDJSON_HEADERS });
  }

  try {
    const stream = await streamProvider({
      type,
      baseUrl,
      apiKey,
      model,
      messages: windowed,
      temperature,
      topP,
      maxTokens,
      keepAlive,
      signal: req.signal,
    });
    return new Response(stream, { headers: NDJSON_HEADERS });
  } catch (e) {
    const err = e instanceof ProviderError ? e : null;
    return Response.json(
      { error: err?.message ?? (e instanceof Error ? e.message : String(e)) },
      { status: err?.status ?? 502 }
    );
  }
}
