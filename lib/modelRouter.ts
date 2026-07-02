import type { ModelOption } from "./types";

export type RouteRole = "text" | "vision" | "ocr";

export interface RouterSignals {
  hasImage: boolean;
  hasDoc: boolean;
  /** user explicitly asked to read/extract text → force OCR even for images */
  ocrIntent?: boolean;
}

// Phrases that signal "read the text out of this" → trigger the OCR model.
const OCR_INTENT_RE =
  /\b(ocr)\b|extrahiere?\s+(den\s+|allen\s+)?text|text\s+(aus|auslesen|extrahieren|erkennen)|auslesen|abtippen|transkribiere|was\s+steht\s+(hier|da|drauf|drin|im)|lies\s+.*(text|vor)|read\s+(the\s+)?text|extract\s+(the\s+)?text|what\s+does\s+(it|this|the\s+\w+)\s+say/i;

export const wantsOcr = (text: string) => OCR_INTENT_RE.test(text || "");
export interface RouterConfig {
  /** primary LLM for plain text (normally the selected model) */
  textKey: string | null;
  /** explicit overrides; when null the router auto-detects by model name */
  visionKey?: string | null;
  ocrKey?: string | null;
}

// Auto-detect specialists by model id when no explicit override is set.
const VISION_RE =
  /(llava|bakllava|moondream|minicpm-?v|llama-?3\.2-vision|qwen2\.?5?-?vl|qwen-?vl|pixtral|gemma-?3|granite.*vision|-vl\b|vision)/i;
const OCR_RE = /(ocr|paddle|got-ocr|nougat|docling)/i;

export const detectVisionKey = (opts: ModelOption[]): string | null =>
  opts.find((o) => VISION_RE.test(o.model))?.key ?? null;

/** OCR-specialist if present, else fall back to a vision model. */
export const detectOcrKey = (opts: ModelOption[]): string | null =>
  opts.find((o) => OCR_RE.test(o.model))?.key ?? detectVisionKey(opts);

/**
 * Route a turn to the right model:
 *   document (PDF/scan) → OCR model (else vision),
 *   image              → vision model,
 *   plain text         → primary LLM.
 * Falls back to textKey whenever no specialist is configured/available, so
 * Auto mode never dead-ends.
 */
export function routeModelKey(
  cfg: RouterConfig,
  signals: RouterSignals,
  options: ModelOption[]
): { key: string | null; role: RouteRole } {
  // Document, or an image the user explicitly wants transcribed → OCR model.
  if (signals.hasDoc || (signals.hasImage && signals.ocrIntent)) {
    const k = cfg.ocrKey || detectOcrKey(options);
    if (k) return { key: k, role: "ocr" };
  }
  if (signals.hasImage) {
    const k = cfg.visionKey || detectVisionKey(options);
    if (k) return { key: k, role: "vision" };
  }
  return { key: cfg.textKey, role: "text" };
}

/** System instruction added when the router sends an attachment to a
 *  vision/OCR model — turns it into the "quick document read" pipeline. */
export const OCR_SYSTEM_HINT =
  "Der Nutzer hat ein Dokument oder Bild angehängt. Falls es Text enthält, " +
  "lies ihn vollständig per OCR aus. Strukturiere anschließend die Kern-" +
  "Informationen (z. B. Absender/Kunde, Datum, Betreff, Beträge, Positionen, " +
  "Fristen) übersichtlich und fasse sie prägnant zusammen, bevor du auf die " +
  "Frage des Nutzers eingehst.";
