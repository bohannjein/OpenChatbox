/** Shared HTTP/route helpers for the API routes. */

/** Per-file upload cap (25 MB). Base64-inlined bytes bloat later chat requests,
 *  so uploads/persisted files are rejected above this with a clean JSON error. */
export const MAX_BYTES = 25 * 1024 * 1024;

/** Strip a data-URL prefix ("data:…;base64,") → the raw base64 payload. */
export const stripPrefix = (u: string) => {
  const i = u.indexOf("base64,");
  return i >= 0 ? u.slice(i + 7) : u;
};

/** MIME type from a data-URL ("data:image/png;base64,…" → "image/png").
 *  Returns `fallback` (or undefined) when the URL carries no media type. */
export function mimeOf(u: string, fallback: string): string;
export function mimeOf(u: string): string | undefined;
export function mimeOf(u: string, fallback?: string): string | undefined {
  return /^data:([^;]+);/.exec(u)?.[1] ?? fallback;
}

/** Response headers for a streamed NDJSON body (chat / pull / terminal). */
export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;
