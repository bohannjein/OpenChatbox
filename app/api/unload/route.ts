import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unload an Ollama model from memory via keep_alive: 0.
 * A generate call with no prompt and keep_alive 0 frees the model immediately.
 */
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

  try {
    await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0 }),
    });
  } catch {
    // best effort — ignore
  }
  return new Response(null, { status: 204 });
}
