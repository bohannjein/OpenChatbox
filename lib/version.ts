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
      "Chat mit Ollama und OpenAI-kompatiblen Backends: Streaming-Antworten, Markdown mit Code-Blöcken, Copy-Buttons und Code-Splitscreen.",
      "Auto-Router: jede Anfrage geht automatisch an das passende Modell (Coding, Reasoning, Vision, Standard).",
      "Wissensdatenbank (RAG) mit Datei-Upload (PDF, DOCX, XLSX, TXT, MD, CSV, PPTX) und Quellenangaben.",
      "BookStack-Wiki-Anbindung mit Such-Protokoll, Troubleshooting-Scan und automatischer Rechtschreibkorrektur.",
      "Fuzzy-Eigennamen-Korrektur: firmenspezifische Namen (z. B. „ispa hub“) werden bei Tippfehlern per Levenshtein-Distanz erkannt und vor der Suche korrigiert.",
      "Internetsuche über konfigurierbare Anbieter (Bing, Tavily, Bocha, Qureit).",
      "Dokument-Generator: PDF- und Excel-Dateien direkt aus einer Chat-Antwort.",
      "Sidekicks, Workspaces und moderierter Gruppen-/Konferenzmodus.",
      "Sicherer Start: Internetsuche und Wissensdatenbank sind in jedem neuen Chat standardmäßig aus.",
      "Stabileres Auto-Scrollen während der Antwort — kein Ruckeln mehr, und die Ansicht bleibt oben, wenn man selbst hochscrollt.",
      "Themes hell/dunkel mit weicher Überblendung, behobene Kontraste im hellen Modus, plus verstecktes „Dracula“-Theme (7-Klick-Easter-Egg).",
      "Info-Bereich mit Version, Repository-Link und „Was gibt's Neues?“ samt Benachrichtigungspunkt für ungesehene Updates.",
      "Admin-Bereich: Modelle (Pull/Aliase), Rollen-Editor, Anbieter, Plugins und Ollama-Web-Terminal; Ersteinrichtung mit Admin-Konto.",
      "Konten mit optionalem SSO (Microsoft Entra / OIDC) und optionaler 2FA.",
    ],
  },
];

/** The version whose changelog is considered "the latest" for the notification. */
export const LATEST_WHATS_NEW = CHANGELOG[0]?.version ?? APP_VERSION;

/** True when the user has not yet seen the latest changelog entry. */
export function hasUnseenWhatsNew(seen: string | undefined | null): boolean {
  return (seen ?? "") !== LATEST_WHATS_NEW;
}
