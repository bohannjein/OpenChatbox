import {
  bumpUsage,
  dayRequests,
  findByKey,
  type Assistant,
  type AssistantKey,
} from "./assistants";
import { clientIp, rateLimit } from "./rateLimit";

/**
 * Authentication and admission control for the public assistant API.
 *
 * Two key kinds, two threat models:
 *  - `secret` (ocb_sk_) lives in a foreign backend. Nobody but that server sees
 *    it, so no origin check applies and CORS is irrelevant.
 *  - `public` (ocb_pk_) ships inside a web page and is therefore readable by
 *    anyone who views the source. Its only protections are the origin allow-list
 *    and the rate limit — which is why both are mandatory for it.
 */

export interface ApiCaller {
  assistant: Assistant;
  key: AssistantKey;
  /** Echo target for CORS; "" for server-to-server calls. */
  origin: string;
  ip: string;
}

export type ApiFailure = { status: number; error: string; retryAfter?: number };

const KEY_HEADER = "x-assistant-key";

/** Bearer token, or the widget's header (browsers can send either). */
function presentedKey(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  return req.headers.get(KEY_HEADER)?.trim() ?? "";
}

/**
 * Resolve the caller from its key. Rejects unknown/revoked keys, disabled
 * assistants, and a widget key used from an origin the admin didn't list.
 * Returns a failure object rather than a Response so the route decides the
 * framing (JSON vs SSE) and can attach CORS headers.
 */
export function authenticateAssistant(req: Request): ApiCaller | ApiFailure {
  const presented = presentedKey(req);
  if (!presented)
    return { status: 401, error: "Kein API-Schlüssel. Erwartet: Authorization: Bearer <key>." };

  const found = findByKey(presented);
  // One message for "wrong key" and "disabled assistant" — telling them apart
  // would let a caller probe which keys exist.
  if (!found) return { status: 401, error: "Ungültiger API-Schlüssel." };

  const origin = req.headers.get("origin") ?? "";
  if (found.key.kind === "public") {
    if (!origin)
      return { status: 403, error: "Widget-Schlüssel erfordern einen Origin-Header." };
    if (!found.assistant.allowedOrigins.includes(origin))
      return { status: 403, error: "Diese Herkunft ist für den Assistenten nicht freigegeben." };
  }

  return { assistant: found.assistant, key: found.key, origin, ip: clientIp(req) };
}

export const isFailure = (v: ApiCaller | ApiFailure): v is ApiFailure =>
  (v as ApiFailure).error !== undefined;

/**
 * Apply the assistant's limits. Counts the rejection so the admin can see that a
 * key is being hammered, then reports how long to wait.
 */
export function checkLimits(c: ApiCaller): ApiFailure | null {
  const { assistant: a } = c;
  const deny = (error: string, retryAfter: number): ApiFailure => {
    bumpUsage(a.id, { denied: 1 });
    return { status: 429, error, retryAfter };
  };

  const perMin = rateLimit(`a:${a.id}`, a.limits.perMinute, 60_000);
  if (!perMin.ok) return deny("Zu viele Anfragen. Bitte kurz warten.", perMin.retryAfter);

  const perIp = rateLimit(`a:${a.id}:ip:${c.ip}`, a.limits.perDayPerIp, 86_400_000);
  if (!perIp.ok) return deny("Tageslimit für diese Adresse erreicht.", perIp.retryAfter);

  if (dayRequests(a) >= a.limits.perDay)
    return deny("Tageslimit des Assistenten erreicht.", 3600);

  return null;
}
