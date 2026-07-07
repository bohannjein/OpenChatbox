/**
 * Single source of truth for the app version, repository info, and the
 * "What's New" changelog. Client- and server-safe (no imports, no side effects)
 * so it can be read from React components and the SettingsModal alike.
 *
 * Bumping the changelog: add a new entry at the TOP of CHANGELOG. Its `version`
 * becomes LATEST_WHATS_NEW, which re-arms the unseen-updates notification dot
 * for every user until they open the Info tab again.
 */

export const APP_VERSION = "1.4.2";

/** owner/name form, shown as a label. */
export const REPO_NAME = "bohannjein/OpenChatbox";
/** Browsable repository page. */
export const REPO_URL = "https://github.com/bohannjein/OpenChatbox";
/** Clone URL (as requested for the Info tab). */
export const REPO_CLONE_URL = "https://github.com/bohannjein/OpenChatbox.git";

export interface ChangelogEntry {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  items: string[];
}

/** Newest first. The top entry's version drives the notification dot. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.2",
    date: "2026-07-07",
    items: [
      "Fuzzy-Eigennamen-Korrektur: firmenspezifische Namen (z. B. „ispa hub“) werden bei Tippfehlern automatisch erkannt und korrigiert, bevor gesucht wird.",
      "Neues, kontraststarkes „Dracula“-Theme — versteckt und über ein kleines Easter-Egg freischaltbar.",
      "Stabileres Auto-Scrollen während der Antwort: kein Ruckeln mehr, und die Ansicht bleibt oben stehen, wenn du selbst hochscrollst.",
      "Sicherer Start: Internetsuche & Wissensdatenbank sind in jedem neuen Chat standardmäßig aus.",
      "Weiche Theme-Überblendung und behobene Kontraste im hellen Modus.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-06-24",
    items: [
      "BookStack-Wiki-Anbindung mit Such-Protokoll, Troubleshooting-Scan und automatischer Rechtschreibkorrektur.",
      "Dokument-Generator: PDF- und Excel-Dateien direkt aus einer Chat-Antwort.",
      "Virtueller Konferenzraum: mehrere Sidekicks diskutieren moderiert in einer Runde.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-05-30",
    items: [
      "Auto-Router: jede Anfrage landet automatisch beim passenden Modell (Coding, Reasoning, Vision, Standard).",
      "Wissensdatenbank (RAG) mit Kategorien, Datei-Upload und Quellenangabe.",
      "Code-Splitscreen mit Live-Vorschau langer Code-Blöcke.",
    ],
  },
];

/** The version whose changelog is considered "the latest" for the notification. */
export const LATEST_WHATS_NEW = CHANGELOG[0]?.version ?? APP_VERSION;

/** True when the user has not yet seen the latest changelog entry. */
export function hasUnseenWhatsNew(seen: string | undefined | null): boolean {
  return (seen ?? "") !== LATEST_WHATS_NEW;
}
