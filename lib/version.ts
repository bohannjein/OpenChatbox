/**
 * Single source of truth for the app version, repository info, and the
 * "What's New" changelog. Client- and server-safe (no imports, no side effects)
 * so it can be read from React components and the SettingsModal alike.
 *
 * Bumping the changelog: add a new entry at the TOP of CHANGELOG. Its `version`
 * becomes LATEST_WHATS_NEW, which re-arms the unseen-updates notification dot
 * for every user until they open the Info tab again.
 */

export const APP_VERSION = "0.9.0";

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

/** Newest first. The top entry's version drives the notification dot. Kept in
 *  sync with the GitHub releases (same version + scope). */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.9.0",
    date: "2026-07-07",
    items: [
      "Chat mit Ollama und OpenAI-kompatiblen Backends, Streaming-Antworten und Markdown.",
      "Auto-Router: jede Anfrage geht automatisch an das passende Modell (Coding, Reasoning, Vision, Standard).",
      "Wissensdatenbank (RAG) und BookStack-Wiki-Anbindung mit Quellenangaben und Fuzzy-/Eigennamen-Korrektur der Suche.",
      "Internetsuche über konfigurierbare Anbieter — pro Chat standardmäßig aus.",
      "Dokument-Generator (PDF/Excel) und Datei-Upload (PDF, DOCX, XLSX, u. a.).",
      "Sidekicks, Workspaces und moderierter Gruppen-/Konferenzmodus.",
      "Themes hell/dunkel (plus verstecktes Dracula) und stabiles Auto-Scrollen.",
      "Admin-Bereich: Modelle, Rollen, Anbieter, Plugins; Ersteinrichtung mit Admin-Konto.",
      "Info-Bereich mit Version, Repository und „Was gibt's Neues?“.",
    ],
  },
];

/** The version whose changelog is considered "the latest" for the notification. */
export const LATEST_WHATS_NEW = CHANGELOG[0]?.version ?? APP_VERSION;

/** True when the user has not yet seen the latest changelog entry. */
export function hasUnseenWhatsNew(seen: string | undefined | null): boolean {
  return (seen ?? "") !== LATEST_WHATS_NEW;
}
