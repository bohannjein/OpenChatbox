/**
 * Sliding-window context filter. Keeps a conversation within a model's context
 * window WITHOUT losing the thread: leading system messages (global prompt /
 * sidekick instructions) are always kept, then the most recent turns are kept up
 * to a message-count cap and an approximate token budget. Older turns are dropped
 * from the front (after the system prompt) — never the system prompt, and never
 * the newest turn.
 */

interface WindowMessage {
  role: string;
  content: string;
  images?: string[];
}

const CHARS_PER_TOKEN = 4; // rough heuristic (good enough for budgeting)

/** Approximate token cost of a message: content + role overhead + image tax. */
function approxTokens(m: WindowMessage): number {
  const imageTax = (m.images?.length ?? 0) * 800; // vision payloads are large
  return Math.ceil((m.content?.length ?? 0) / CHARS_PER_TOKEN) + 4 + imageTax;
}

export interface ContextWindowOpts {
  /** hard cap on non-system messages kept (default 20). */
  maxMessages?: number;
  /** approximate token budget for the whole payload (default 8000). */
  maxTokens?: number;
}

export function applyContextWindow<T extends WindowMessage>(
  messages: T[],
  opts: ContextWindowOpts = {}
): T[] {
  const maxMessages = opts.maxMessages ?? 20;
  const maxTokens = opts.maxTokens ?? 8000;
  if (messages.length <= 1) return messages;

  // Leading system messages are pinned at the front and never dropped.
  let head = 0;
  while (head < messages.length && messages[head].role === "system") head++;
  const system = messages.slice(0, head);
  const rest = messages.slice(head);

  // 1) Cap by count — keep the most recent N turns.
  const recent = rest.slice(-maxMessages);

  // 2) Token-budget trim from the oldest, but always keep the newest turn.
  const systemTokens = system.reduce((n, m) => n + approxTokens(m), 0);
  let budget = Math.max(0, maxTokens - systemTokens);
  const kept: T[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const cost = approxTokens(recent[i]);
    if (kept.length > 0 && budget - cost < 0) break; // keep ≥1 (newest) turn
    budget -= cost;
    kept.unshift(recent[i]);
  }

  return [...system, ...kept];
}
