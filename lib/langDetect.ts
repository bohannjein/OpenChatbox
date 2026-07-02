export type DetectedLang = "de" | "en";

// Lightweight stopword heuristic — enough to keep the model from drifting.
const DE =
  /\b(und|oder|nicht|ich|du|wir|der|die|das|ist|sind|ein|eine|mit|auf|für|kann|wie|was|warum|bitte|danke|wenn|weil|aber|auch|noch|schon|über)\b/gi;
const EN =
  /\b(the|and|or|not|you|we|is|are|a|an|with|for|how|what|why|please|thanks|because|but|also|still|about|this|that|would|could)\b/gi;

/** Best-effort language of a user message. Returns null when undecidable. */
export function detectLang(text: string): DetectedLang | null {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return null;
  if (/[äöüß]/.test(t)) return "de"; // German-only characters → decisive
  const de = (t.match(DE) || []).length;
  const en = (t.match(EN) || []).length;
  if (de === 0 && en === 0) return null;
  return de >= en ? "de" : "en";
}

/**
 * System instruction that pins the answer language. Uses the detected language
 * when confident; otherwise a generic "same language" rule so the model never
 * switches — not even for technical terms.
 */
export function languageConstraint(text: string): string {
  switch (detectLang(text)) {
    case "de":
      return "[Sprache: Antworte ausschließlich auf Deutsch — auch bei englischen Fachbegriffen. Wechsle nicht ins Englische.]";
    case "en":
      return "[Language: Reply exclusively in English.]";
    default:
      return "[Antworte in exakt derselben Sprache wie die letzte Nachricht des Nutzers. Wechsle die Sprache nicht, auch nicht für Fachbegriffe.]";
  }
}
