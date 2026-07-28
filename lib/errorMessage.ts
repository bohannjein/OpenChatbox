/**
 * Turns whatever a provider or fetch threw into something a non-technical user
 * can act on. The raw text is kept as a small trailing line so support and
 * admins still have something to work with — it is the *diagnosis* that moves
 * out of the way, not the evidence.
 *
 * Errors reaching here come from lib/providers.ts (which rethrows the response
 * body or `HTTP <status>`), from fetch itself, and from the doc/image routes.
 */

type Rule = { test: RegExp; message: string };

/** First match wins, so put the specific patterns above the generic ones. */
const RULES: Rule[] = [
  {
    test: /abort|cancel/i,
    message: "Die Anfrage wurde abgebrochen.",
  },
  {
    test: /context length|context window|too many tokens|maximum context/i,
    message:
      "Diese Unterhaltung ist zu lang für das Modell geworden. Starte einen neuen Chat — die bisherigen Antworten bleiben erhalten.",
  },
  {
    test: /rate limit|too many requests|\b429\b/i,
    message:
      "Gerade sind zu viele Anfragen unterwegs. Warte einen Moment und schick die Nachricht erneut.",
  },
  {
    test: /unauthorized|forbidden|invalid api key|api key|\b401\b|\b403\b/i,
    message:
      "Der Zugang zum KI-Dienst wurde abgelehnt. Das sind hinterlegte Zugangsdaten — bitte deine Administration informieren.",
  },
  {
    test: /model .*not found|no such model|unknown model|\b404\b/i,
    message:
      "Dieses Modell steht gerade nicht zur Verfügung. Wähle oben in der Kopfzeile ein anderes Modell.",
  },
  {
    test: /timed? ?out|etimedout|deadline/i,
    message:
      "Die Antwort hat zu lange gedauert und wurde abgebrochen. Versuch es noch einmal oder stelle eine kürzere Frage.",
  },
  {
    test: /econnrefused|enotfound|econnreset|network|failed to fetch|fetch failed|load failed/i,
    message:
      "Der KI-Server ist nicht erreichbar. Prüfe deine Internetverbindung — bleibt es dabei, hilft deine Administration weiter.",
  },
  {
    test: /\b5\d\d\b|internal server error|bad gateway|service unavailable/i,
    message:
      "Der KI-Dienst hat einen Fehler gemeldet. Versuch es gleich noch einmal.",
  },
  {
    test: /out of memory|insufficient memory|cuda|vram/i,
    message:
      "Dem Server ist der Speicher ausgegangen. Ein kleineres Modell klappt meistens — sonst bitte die Administration informieren.",
  },
];

const FALLBACK =
  "Da ist etwas schiefgelaufen. Versuch es noch einmal — bleibt der Fehler, hilft deine Administration weiter.";

/** The plain-language sentence alone, without the technical trailer. */
export function humanizeError(e: unknown): string {
  const raw = rawText(e);
  return RULES.find((r) => r.test.test(raw))?.message ?? FALLBACK;
}

/** Original text of whatever was thrown, trimmed and collapsed to one line. */
export function rawText(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e ?? "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Chat-ready block: the readable sentence, plus the original text in small
 * print. Markdown — it is written straight into a message body, and the
 * renderer strips raw HTML (no rehypeRaw), so emphasis has to carry it.
 */
export function errorForChat(e: unknown): string {
  const raw = rawText(e);
  const human = humanizeError(e);
  // Nothing useful to append (or the raw text IS the message) → keep it clean.
  if (!raw || raw === human) return `⚠️ ${human}`;
  return `⚠️ ${human}\n\n_Technisch: ${raw}_`;
}
