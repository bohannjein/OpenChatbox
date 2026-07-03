import type { ModelOption } from "./types";

export type RouteRole = "text" | "coding" | "reasoning" | "vision";
export type RouterCategory = "coding" | "reasoning" | "vision";

export interface RouterSignals {
  hasImage: boolean;
  hasDoc: boolean;
  text: string;
}
export interface RouterConfig {
  /** Standard/Text model (normally the selected model) — the fallback. */
  standardKey: string | null;
  coding?: string | null;
  reasoning?: string | null;
  vision?: string | null;
}

// Keyword scan for the text categories (German + English).
const CODING_RE =
  /\b(code|coding|skript|script|python|javascript|typescript|golang|rust|java|c\+\+|c#|bug|debug|fehler|funktion|function|programm|programmier|compile|kompilier|regex|sql|html|css|api|refactor|klasse|klassen|method|stacktrace|terminal|shell|docker)\b|schreib\w*\s+(ein|mir|eine)?\s*(skript|programm|code|funktion|klasse)/i;
const REASONING_RE =
  /\b(rechne|berechne|logik|logisch|beweise?|beweis|mathe|mathematik|gleichung|formel|schritt\s*f[üu]r\s*schritt|denke?\s*nach|reasoning|l[öo]se|solve|calculate|proof|herleit|integral|ableitung|prozent|wahrscheinlichkeit|wie\s*viel)\b/i;

// Auto-detect a vision-capable model by id when no explicit mapping is set.
const VISION_RE =
  /(llava|bakllava|moondream|minicpm-?v|llama-?3\.2-vision|qwen2\.?5?-?vl|qwen-?vl|pixtral|gemma-?3|granite.*vision|-vl\b|vision)/i;

export const detectVisionKey = (opts: ModelOption[]): string | null =>
  opts.find((o) => VISION_RE.test(o.model))?.key ?? null;

/** Classify a plain-text prompt into a text category. */
export function detectCategory(text: string): "coding" | "reasoning" | "standard" {
  const t = text || "";
  if (CODING_RE.test(t)) return "coding";
  if (REASONING_RE.test(t)) return "reasoning";
  return "standard";
}

/**
 * Route a turn to a model:
 *   image/document → Vision model,
 *   coding keywords → Coding model,
 *   reasoning/math keywords → Reasoning model,
 *   else → Standard/Text model.
 * Falls back to standardKey whenever a category has no model assigned, so
 * Auto mode never dead-ends.
 */
export function routeModelKey(
  cfg: RouterConfig,
  signals: RouterSignals,
  options: ModelOption[]
): { key: string | null; role: RouteRole } {
  if (signals.hasImage || signals.hasDoc) {
    const k = cfg.vision || detectVisionKey(options);
    if (k) return { key: k, role: "vision" };
  }
  const cat = detectCategory(signals.text);
  if (cat === "coding" && cfg.coding) return { key: cfg.coding, role: "coding" };
  if (cat === "reasoning" && cfg.reasoning) return { key: cfg.reasoning, role: "reasoning" };
  return { key: cfg.standardKey, role: "text" };
}

/** System instruction added when an attachment is routed to a Vision model —
 *  turns it into the quick document/OCR read pipeline. */
export const OCR_SYSTEM_HINT =
  "Der Nutzer hat ein Dokument oder Bild angehängt. Falls es Text enthält, " +
  "lies ihn vollständig aus. Strukturiere anschließend die Kern-Informationen " +
  "(z. B. Absender/Kunde, Datum, Betreff, Beträge, Positionen, Fristen) und " +
  "fasse sie prägnant zusammen, bevor du auf die Frage des Nutzers eingehst.";
