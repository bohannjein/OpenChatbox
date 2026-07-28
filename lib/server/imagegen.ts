import { getImageGenConfig } from "./config";

/**
 * Image generation via an admin-configured backend. Returns a data URL (base64
 * PNG). Supported: OpenAI-compatible /images/generations and Automatic1111
 * (/sdapi/v1/txt2img). ComfyUI needs a workflow graph → not generalized here.
 * The API key stays server-side.
 */
const TIMEOUT_MS = 120_000; // image gen is slow

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function generateImage(
  prompt: string
): Promise<{ dataUrl?: string; error?: string }> {
  const cfg = getImageGenConfig();
  if (!cfg) return { error: "Bildgenerierung ist nicht konfiguriert." };
  const p = prompt.trim();
  if (!p) return { error: "Kein Prompt." };

  try {
    if (cfg.type === "openai") {
      const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
      const r = await timedFetch(`${base}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.model || "gpt-image-1",
          prompt: p,
          n: 1,
          size: cfg.size || "1024x1024",
          response_format: "b64_json",
        }),
      });
      if (!r.ok) return { error: `OpenAI-Images HTTP ${r.status}` };
      const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] };
      const b64 = j.data?.[0]?.b64_json;
      if (b64) return { dataUrl: `data:image/png;base64,${b64}` };
      const url = j.data?.[0]?.url;
      return url ? { dataUrl: url } : { error: "Leere Bildantwort." };
    }

    if (cfg.type === "automatic1111") {
      const base = (cfg.baseUrl || "http://localhost:7860").replace(/\/+$/, "");
      const [w, h] = (cfg.size || "1024x1024").split("x").map((n) => parseInt(n, 10) || 1024);
      const r = await timedFetch(`${base}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ prompt: p, steps: 25, width: w, height: h }),
      });
      if (!r.ok) return { error: `Automatic1111 HTTP ${r.status}` };
      const j = (await r.json()) as { images?: string[] };
      const b64 = j.images?.[0];
      return b64
        ? { dataUrl: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}` }
        : { error: "Leere Bildantwort." };
    }

    return {
      error:
        "ComfyUI erfordert eine Workflow-Konfiguration und wird noch nicht unterstützt.",
    };
  } catch (e) {
    return { error: `Bildgenerierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` };
  }
}
