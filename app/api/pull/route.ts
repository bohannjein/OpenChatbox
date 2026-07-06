import { NextRequest } from "next/server";
import { NDJSON_HEADERS } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy Ollama /api/pull, forwarding its NDJSON progress stream verbatim. */
export async function POST(req: NextRequest) {
  let body: { baseUrl?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const baseUrl = (body.baseUrl || "").replace(/\/+$/, "");
  const model = (body.model || "").trim();
  if (!baseUrl || !model)
    return new Response("baseUrl und model erforderlich", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      signal: req.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Verbindung fehlgeschlagen: ${msg}`, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      `Ollama-Fehler (HTTP ${upstream.status}) ${detail}`.trim(),
      { status: 502 }
    );
  }

  // Ollama already emits NDJSON — pass through unchanged.
  return new Response(upstream.body, { headers: NDJSON_HEADERS });
}
