import { useStore } from "./store";

export type Lang = "de" | "en";

/** First-load UI language from the browser (de fallback). */
export function detectBrowserLang(): Lang {
  try {
    return (navigator.language || "de").toLowerCase().startsWith("en") ? "en" : "de";
  } catch {
    return "de";
  }
}

type Entry = { de: string; en: string };
const STRINGS = {
  "sidebar.newChat": { de: "Neuer Chat", en: "New chat" },
  "sidebar.search": { de: "Chats durchsuchen…", en: "Search chats…" },
  "sidebar.sidekicks": { de: "Meine Sidekicks", en: "My sidekicks" },
  "sidebar.noChats": { de: "Noch keine Chats.", en: "No chats yet." },
  "sidebar.pinned": { de: "Angeheftet", en: "Pinned" },
  "workspace.switch": { de: "Workspace wechseln", en: "Switch workspace" },
  "workspace.new": { de: "Neuer Workspace", en: "New workspace" },
  "input.placeholder": {
    de: "Stelle deine Frage, lade Dokumente hoch oder starte einen Prompt…",
    en: "Ask a question, upload documents, or start a prompt…",
  },
  "input.hint": {
    de: "Enter zum Senden · Shift+Enter für Zeilenumbruch · „/“ für Vorlagen · 📎 für Dateien",
    en: "Enter to send · Shift+Enter for newline · “/” for templates · 📎 for files",
  },
  "chat.disclaimer": {
    de: "Eine KI kann Fehler machen. Bitte überprüfe wichtige Informationen.",
    en: "AI can make mistakes. Please verify important information.",
  },
  "chat.model": { de: "Modell", en: "Model" },
  "chat.pickModel": { de: "Wähle oben ein Modell, um zu starten.", en: "Pick a model above to start." },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

/** Translate with the current UI language (falls back to de before auto-detect). */
export function useT(): (key: StringKey, fallback?: string) => string {
  const lang = (useStore((s) => s.lang) ?? "de") as Lang;
  return (key, fallback) => {
    const e = STRINGS[key];
    return e ? e[lang] ?? e.de : fallback ?? String(key);
  };
}
