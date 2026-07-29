/**
 * In-memory sliding-window rate limiter for the public assistant API.
 *
 * Deliberately process-local: no store, no extra file writes on the hot path. On
 * a multi-replica deployment each replica enforces its own share — worth knowing,
 * but far better than the nothing that existed before a public endpoint.
 */

const hits = new Map<string, number[]>();

/** Bound the map so a flood of distinct IPs can't grow it without limit. */
const MAX_BUCKETS = 20_000;

/**
 * Record a hit and report whether the caller is over the limit.
 * Returns `retryAfter` in seconds when blocked.
 */
export function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (hits.get(bucket) ?? []).filter((t) => t > cutoff);

  if (arr.length >= limit) {
    hits.set(bucket, arr);
    const retryAfter = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
    return { ok: false, retryAfter, remaining: 0 };
  }

  arr.push(now);
  if (!hits.has(bucket) && hits.size >= MAX_BUCKETS) prune(cutoff);
  hits.set(bucket, arr);
  return { ok: true, retryAfter: 0, remaining: limit - arr.length };
}

/** Drop buckets whose newest hit is older than the cutoff. */
function prune(cutoff: number): void {
  for (const [k, v] of hits) {
    if (!v.length || v[v.length - 1] <= cutoff) hits.delete(k);
  }
  // Still full (all buckets active) → evict arbitrary entries rather than grow.
  if (hits.size >= MAX_BUCKETS) {
    let n = Math.ceil(MAX_BUCKETS / 10);
    for (const k of hits.keys()) {
      hits.delete(k);
      if (--n <= 0) break;
    }
  }
}

/** Caller IP from the proxy headers, or "?" when nothing is forwarded. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "?";
}

/** Test seam: forget all recorded hits. */
export function resetRateLimits(): void {
  hits.clear();
}
