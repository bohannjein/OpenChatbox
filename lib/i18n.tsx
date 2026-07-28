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
  // Auto-pipeline live status badges + hints.
  "pipeline.ocr": {
    de: "OCR-Modell analysiert Dokument…",
    en: "OCR model is analysing the document…",
  },
  "pipeline.answer": {
    de: "Allrounder formuliert Antwort…",
    en: "Allrounder is composing the answer…",
  },
  "pipeline.vision": {
    de: "Vision-Modell liest Dokument…",
    en: "Vision model is reading the document…",
  },
  "pipeline.coding": {
    de: "Coding-Modell arbeitet…",
    en: "Coding model is working…",
  },
  "pipeline.reasoning": {
    de: "Reasoning-Modell denkt nach…",
    en: "Reasoning model is thinking…",
  },
  "pipeline.text": { de: "Modell antwortet…", en: "Model is answering…" },
  "pipeline.imagegen": { de: "Erzeugt ein Bild…", en: "Generating an image…" },
  "pipeline.search": { de: "Durchsucht das Web…", en: "Searching the web…" },
  "pipeline.knowledge": {
    de: "Durchsucht die Wissensdatenbank…",
    en: "Searching the knowledge base…",
  },
  "pipeline.imagegenHint": {
    de: "🎨 Bildgenerierung ist noch nicht verfügbar. Dieses System kann Bilder lesen und analysieren, aber (noch) keine neuen Bilder erzeugen.",
    en: "🎨 Image generation is not available yet. This system can read and analyse images, but cannot (yet) create new ones.",
  },
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
