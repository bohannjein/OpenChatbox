import type { ModelOption, PipelineStage } from "./types";
import { detectCategory, detectVisionKey, OCR_SYSTEM_HINT } from "./modelRouter";

export type { PipelineStage };

/**
 * Agentic Auto-mode coordinator. Classifies a turn into a scenario and produces
 * an ordered list of model steps the client runs sequentially:
 *  - "ocr"    : an image/scanned-PDF is attached → a Vision/OCR model extracts
 *               the raw text FIRST, which is then handed to the answer model.
 *  - "answer" : the standard/allrounder model that formulates the reply (stage 2
 *               of the OCR chain, using the extracted text as hidden context).
 *  - "coding"/"reasoning"/"text" : single-model text scenarios.
 *  - "imagegen": the user asked to *generate* an image — not yet supported
 *               (Ollama can't), so no model runs and the UI shows a hint.
 * Pure & side-effect free so it can be unit-tested without a model.
 */
export type Scenario = "ocr-chain" | "imagegen" | "text";

export interface PipelineStep {
  role: PipelineStage;
  /** Model key to run this step with (already resolved against the config). */
  key: string;
}

export interface PipelinePlan {
  scenario: Scenario;
  steps: PipelineStep[];
  /** True when the OCR chain degraded to a single vision call (no answer model
   *  distinct from the vision model, or no vision model at all). */
  singleVisionFallback?: boolean;
}

export interface PipelineConfig {
  /** Standard/answer model (routerModels.standard) or the selected model. */
  standardKey: string | null;
  coding?: string | null;
  reasoning?: string | null;
  vision?: string | null;
}

export interface PipelineSignals {
  /** The turn we answer has image attachments (photos / rendered PDF pages). */
  hasImage: boolean;
  /** A non-image document is attached (text already extracted into context). */
  hasDoc: boolean;
  text: string;
}

// "generate an image" intent — must NOT match "read the image / analyse image".
// Requires a create-verb bound to an image noun (German + English).
const IMAGE_GEN_RE =
  /\b(generiere?|erstelle?|erzeuge?|mal(e|st)?|zeichne|create|generate|draw|paint|render)\b[^.\n]{0,40}\b(bild|foto|photo|image|picture|grafik|graphic|illustration|artwork|logo|gem[äa]lde|zeichnung|poster)\b|\b(bild|foto|image|picture)\s+(von|of|mit|with)\b/i;

/** True if the prompt asks to *generate* a picture (not analyse an attached one). */
export const isImageGenRequest = (text: string, hasAttachment: boolean): boolean =>
  !hasAttachment && IMAGE_GEN_RE.test(text || "");

/** System prompt for stage 1 of the OCR chain: extract only, never answer. */
export const OCR_EXTRACT_ONLY =
  "Du bist ein reines OCR- und Extraktions-Modul. Gib den GESAMTEN Text- und " +
  "Dateninhalt des angehängten Bildes/Dokuments vollständig und wortgetreu wieder " +
  "— strukturiert (Absender/Kunde, Datum, Betreff, Positionen, Beträge, Tabellen " +
  "als Text, Fußzeilen). Interpretiere NICHT, fasse NICHT zusammen, beantworte KEINE " +
  "Frage, füge KEINE Anrede oder Erklärung hinzu. Ausschließlich der extrahierte " +
  "Inhalt.";

/** System prompt for the search-query construction model. */
export const SEARCH_QUERY_SYSTEM =
  "Formuliere aus der folgenden Nutzerfrage eine knappe, präzise Web-Suchanfrage " +
  "(wenige Schlüsselwörter, keine ganzen Sätze, keine Anführungszeichen). Gib " +
  "AUSSCHLIESSLICH die Suchanfrage aus, sonst nichts.";

/** Build the web-search result context injected into the answer model's prompt. */
export const buildSearchContext = (
  results: { title: string; url: string; snippet: string }[]
): string =>
  "Aktuelle Web-Suchergebnisse — nutze sie für die Antwort und zitiere Quellen " +
  "als [n]:\n\n" +
  results
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`)
    .join("\n\n");

/** Hidden context injected into stage 2 (the answer model) of the OCR chain. */
export const buildOcrContext = (extracted: string): string =>
  "Der Nutzer hat eine Datei angehängt. Ein OCR-Modell hat daraus folgenden Inhalt " +
  "extrahiert. Beantworte die Frage des Nutzers auf Basis dieses Inhalts (erwähne " +
  "das OCR-Modell nicht):\n\n<<<EXTRAHIERTER-INHALT\n" +
  extracted.trim() +
  "\nEXTRAHIERTER-INHALT>>>";

// Re-export so the orchestrator can add the single-call OCR hint on fallback.
export { OCR_SYSTEM_HINT };

/**
 * Build the pipeline plan for a turn. `standardKey` is the answer/fallback model
 * (never dead-ends: an unassigned category falls back to it).
 */
export function planPipeline(
  cfg: PipelineConfig,
  signals: PipelineSignals,
  options: ModelOption[]
): PipelinePlan {
  const answerKey = cfg.standardKey;

  // Szenario B — image generation (no attachment). Not supported yet.
  if (isImageGenRequest(signals.text, signals.hasImage || signals.hasDoc)) {
    return { scenario: "imagegen", steps: [] };
  }

  // Szenario A — OCR chain (only when an IMAGE is attached; text docs are already
  // extracted into the system prompt upstream, so they need no vision stage).
  if (signals.hasImage) {
    const visionKey = cfg.vision || detectVisionKey(options);
    // No vision model at all → answer model handles it directly.
    if (!visionKey) {
      return answerKey
        ? { scenario: "text", steps: [{ role: "answer", key: answerKey }] }
        : { scenario: "text", steps: [] };
    }
    // Vision == answer model (or no distinct answer model) → single vision call
    // with the inline OCR hint (old behaviour), no separate extraction stage.
    if (!answerKey || answerKey === visionKey) {
      return {
        scenario: "ocr-chain",
        steps: [{ role: "vision", key: visionKey }],
        singleVisionFallback: true,
      };
    }
    // Full two-stage chain: extract with vision, answer with standard.
    return {
      scenario: "ocr-chain",
      steps: [
        { role: "ocr", key: visionKey },
        { role: "answer", key: answerKey },
      ],
    };
  }

  // Szenario C — plain text. Category keyword routing (single call).
  const cat = detectCategory(signals.text);
  if (cat === "coding" && cfg.coding)
    return { scenario: "text", steps: [{ role: "coding", key: cfg.coding }] };
  if (cat === "reasoning" && cfg.reasoning)
    return { scenario: "text", steps: [{ role: "reasoning", key: cfg.reasoning }] };
  return answerKey
    ? { scenario: "text", steps: [{ role: "text", key: answerKey }] }
    : { scenario: "text", steps: [] };
}
