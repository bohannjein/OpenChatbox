import { listAssistants } from "./assistants";

/**
 * CORS for the public API. Never `*`: an origin is echoed back only when some
 * enabled assistant lists it, so a random site cannot read responses from a
 * visitor's browser even if it guesses a key.
 *
 * Preflight runs before any key is presented (browsers don't send custom headers
 * on OPTIONS), so it can only check the origin against the union of all
 * allow-lists; the per-assistant check happens on the actual request in
 * apiAuth.authenticateAssistant.
 */
const ALLOW_HEADERS = "Content-Type, Authorization, X-Assistant-Key";

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  return listAssistants().some((a) => a.enabled && a.allowedOrigins.includes(origin));
}

export function corsHeaders(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    // Same URL answers differently per origin — caches must key on it.
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = ALLOW_HEADERS;
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

/** Preflight answer. 204 either way; a disallowed origin simply gets no grant. */
export function preflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") ?? ""),
  });
}
