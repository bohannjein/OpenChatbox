import { NextRequest, NextResponse } from "next/server";
import type { ProviderRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: ProviderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const baseUrl = (body.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl)
    return NextResponse.json({ error: "baseUrl fehlt" }, { status: 400 });

  try {
    if (body.type === "ollama") {
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

    if (body.type === "anthropic") {
      const r = await fetch(`${baseUrl}/models`, {
        cache: "no-store",
        headers: {
          "x-api-key": body.apiKey ?? "",
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
      headers: body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {},
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
