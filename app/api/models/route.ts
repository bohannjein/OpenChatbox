import { NextRequest, NextResponse } from "next/server";
import type { ProviderRequest } from "@/lib/types";
import { getProviderById, isKnownProviderBaseUrl } from "@/lib/server/config";
import { getUser } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: ProviderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve provider from the server registry when a providerId is given
  // (keeps secret apiKeys off the client); else use the client-sent values.
  const resolved = body.providerId ? getProviderById(body.providerId) : undefined;
  const type = resolved?.type ?? body.type;
  const apiKey = resolved?.apiKey ?? body.apiKey;
  const baseUrl = (resolved?.baseUrl ?? body.baseUrl ?? "").replace(/\/+$/, "");
  if (!baseUrl)
    return NextResponse.json({ error: "baseUrl fehlt" }, { status: 400 });
  // Same fetch-proxy guard as /api/chat.
  if (!resolved && user.role !== "admin" && !isKnownProviderBaseUrl(baseUrl))
    return NextResponse.json({ error: "Unbekannter Anbieter." }, { status: 400 });

  try {
    if (type === "ollama") {
      const r = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
      if (!r.ok)
        return NextResponse.json(
          { error: `Ollama /api/tags: HTTP ${r.status}` },
          { status: 502 }
        );
      const data = (await r.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name).sort();
      return NextResponse.json({ models });
    }

    if (type === "anthropic") {
      const r = await fetch(`${baseUrl}/models`, {
        cache: "no-store",
        headers: {
          "x-api-key": apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
      });
      if (!r.ok)
        return NextResponse.json(
          { error: `Anthropic /models: HTTP ${r.status}` },
          { status: 502 }
        );
      const data = (await r.json()) as { data?: { id: string }[] };
      const models = (data.data ?? []).map((m) => m.id).sort();
      return NextResponse.json({ models });
    }

    // openai-compatible
    const r = await fetch(`${baseUrl}/models`, {
      cache: "no-store",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!r.ok)
      return NextResponse.json(
        { error: `/models: HTTP ${r.status}` },
        { status: 502 }
      );
    const data = (await r.json()) as { data?: { id: string }[] };
    const models = (data.data ?? []).map((m) => m.id).sort();
    return NextResponse.json({ models });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Verbindung fehlgeschlagen: ${msg}` },
      { status: 502 }
    );
  }
}
