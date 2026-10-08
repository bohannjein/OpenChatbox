import { useCallback } from "react";
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
/**
 * UI strings. German is the source wording — change it only on purpose.
 * `{name}` placeholders are filled from the `vars` argument of `t()`.
 * Every user-visible UI string lives here, admin panels included. Model-facing
 * prompts, stored data (e.g. default brand texts) and server error details stay German.
 */
const STRINGS = {
  // ── shared ────────────────────────────────────────────────────────────
  "common.save": { de: "Speichern", en: "Save" },
  "common.cancel": { de: "Abbrechen", en: "Cancel" },
  "common.delete": { de: "Löschen", en: "Delete" },
  "common.rename": { de: "Umbenennen", en: "Rename" },
  "common.close": { de: "Schließen", en: "Close" },
  "common.confirm": { de: "Bestätigen", en: "Confirm" },
  "common.remove": { de: "Entfernen", en: "Remove" },
  "common.send": { de: "Senden", en: "Send" },
  "common.copy": { de: "Kopieren", en: "Copy" },
  "common.edit": { de: "Bearbeiten", en: "Edit" },
  "common.back": { de: "Zurück", en: "Back" },
  "common.download": { de: "Herunterladen", en: "Download" },
  "common.downloadNamed": { de: "{name} herunterladen", en: "Download {name}" },
  "common.deleteNamed": { de: "{name} löschen", en: "Delete {name}" },
  "common.removeNamed": { de: "{name} entfernen", en: "Remove {name}" },
  "common.loading": { de: "Lädt…", en: "Loading…" },
  "common.signIn": { de: "Anmelden", en: "Sign in" },
  "common.signOut": { de: "Abmelden", en: "Sign out" },
  "common.darkMode": { de: "Dark Mode", en: "Dark mode" },
  "common.lightMode": { de: "Light Mode", en: "Light mode" },
  "common.settings": { de: "Einstellungen", en: "Settings" },
  "common.username": { de: "Benutzername", en: "Username" },
  "common.password": { de: "Passwort", en: "Password" },
  "common.code6": { de: "6-stelliger Code", en: "6-digit code" },
  "common.errNetwork": {
    de: "Server nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    en: "Can't reach the server. Check your connection and try again.",
  },

  // ── sidebar ───────────────────────────────────────────────────────────
  "sidebar.newChat": { de: "Neuer Chat", en: "New chat" },
  "sidebar.search": { de: "Chats durchsuchen…", en: "Search chats…" },
  "sidebar.searchLabel": { de: "Chats durchsuchen", en: "Search chats" },
  "sidebar.searchShortcut": { de: "Chats durchsuchen (⌘K)", en: "Search chats (⌘K)" },
  "sidebar.sidekicks": { de: "Meine Sidekicks", en: "My sidekicks" },
  "sidebar.noChats": { de: "Noch keine Chats.", en: "No chats yet." },
  "sidebar.pinned": { de: "Angepinnt", en: "Pinned" },
  "sidebar.chats": { de: "Chats", en: "Chats" },
  "sidebar.draft": { de: "Entwurf", en: "Draft" },
  "sidebar.pin": { de: "Anpinnen", en: "Pin" },
  "sidebar.unpin": { de: "Lösen", en: "Unpin" },
  "sidebar.moveToFolder": { de: "In Ordner verschieben", en: "Move to folder" },
  "sidebar.noFolder": { de: "Kein Ordner", en: "No folder" },
  "sidebar.collapse": { de: "Sidebar einklappen", en: "Collapse sidebar" },
  "sidebar.guestTitle": { de: "Gast-Modus", en: "Guest mode" },
  "sidebar.guestBody": {
    de: "Du nutzt den Gast-Modus. Melde dich an, um Verläufe zu speichern und Workspaces zu nutzen.",
    en: "You're using guest mode. Sign in to save your chat history and use workspaces.",
  },
  "sidebar.createFolder": { de: "Ordner erstellen", en: "Create folder" },
  "sidebar.newFolder": { de: "Neuer Ordner", en: "New folder" },
  "sidebar.folderMenu": { de: "Ordner-Menü", en: "Folder menu" },
  "sidebar.deleteFolder": { de: "Ordner löschen", en: "Delete folder" },
  "sidebar.folderEmpty": { de: "Leer — zieh Chats hierher.", en: "Empty — drag chats here." },
  "sidebar.signedIn": { de: "Angemeldet", en: "Signed in" },
  "sidebar.switchAccount": { de: "Account wechseln", en: "Switch account" },
  "sidebar.profile": { de: "Profil & Sicherheit", en: "Profile & security" },
  "sidebar.accountMenu": { de: "Konto-Menü", en: "Account menu" },
  "sidebar.user": { de: "Nutzer", en: "User" },
  "sidebar.notes": { de: "Meine Notizen", en: "My notes" },
  "sidebar.notesTitle": { de: "Meine Notizen (chatübergreifend)", en: "My notes (across all chats)" },
  "sidebar.settingsUpdates": { de: "Einstellungen — neue Updates", en: "Settings — new updates" },
  "sidebar.deleteChatTitle": { de: "Chat löschen?", en: "Delete chat?" },
  "sidebar.deleteChatBody": {
    de: "Auch Prompts, Antworten, Feedback und von dir erstellte Inhalte werden aus deinem Aktivitätsverlauf gelöscht.",
    en: "Its prompts, replies, feedback and anything you created in it are also removed from your activity history.",
  },
  "sidebar.deleteFolderTitle": { de: "Ordner „{name}\" löschen?", en: "Delete folder “{name}”?" },
  // {chats} marks where the highlighted count phrase goes.
  "sidebar.deleteFolderBody": {
    de: "Achtung: Dabei werden auch alle {chats} unwiderruflich gelöscht.",
    en: "Warning: this also permanently deletes {chats}.",
  },
  "sidebar.deleteFolderChats": { de: "{n} darin enthaltenen Chats", en: "the {n} chats inside it" },
  "sidebar.deleteFolderChatsOne": { de: "{n} darin enthaltenen Chats", en: "the 1 chat inside it" },
  "sidebar.deleteFolderConfirm": { de: "Ordner & Chats löschen", en: "Delete folder & chats" },
  "workspace.switch": { de: "Workspace wechseln", en: "Switch workspace" },
  "workspace.new": { de: "Neuer Workspace", en: "New workspace" },

  // ── chat window ───────────────────────────────────────────────────────
  "chat.disclaimer": {
    de: "Eine KI kann Fehler machen. Bitte überprüfe wichtige Informationen.",
    en: "AI can make mistakes. Please verify important information.",
  },
  "chat.model": { de: "Modell", en: "Model" },
  "chat.pickModel": { de: "Wähle oben ein Modell, um zu starten.", en: "Pick a model above to start." },
  "chat.noModel": { de: "Kein Modell ausgewählt.", en: "No model selected." },
  "chat.providerMissing": { de: "Provider nicht gefunden.", en: "Provider not found." },
  "chat.done": { de: "Antwort fertig", en: "Response complete" },
  "chat.daypart.morning": { de: "Morgen", en: "morning" },
  "chat.daypart.day": { de: "Tag", en: "afternoon" },
  "chat.daypart.evening": { de: "Abend", en: "evening" },
  // {suffix} is ", <first name>" or empty.
  "chat.greet.0": {
    de: "Guten {daypart}{suffix}! Was kann ich heute für dich tun?",
    en: "Good {daypart}{suffix}! What can I do for you today?",
  },
  "chat.greet.1": { de: "Hallo{suffix}, bereit für neue Projekte?", en: "Hi{suffix}, ready for something new?" },
  "chat.greet.2": { de: "Wie kann ich dir heute helfen{suffix}?", en: "How can I help you today{suffix}?" },
  "chat.greet.3": {
    de: "Schön dich zu sehen{suffix}. Womit legen wir los?",
    en: "Good to see you{suffix}. Where shall we start?",
  },
  "chat.greet.4": {
    de: "Womit kann ich dir heute helfen{suffix}?",
    en: "What can I help you with today{suffix}?",
  },
  "chat.starter.python": { de: "Python-Skript schreiben", en: "Write a Python script" },
  "chat.starter.pythonPrompt": { de: "Schreibe ein Python-Skript, das ", en: "Write a Python script that " },
  "chat.starter.translate": { de: "Text übersetzen", en: "Translate text" },
  "chat.starter.translatePrompt": {
    de: "Übersetze den folgenden Text ins Englische:\n\n",
    en: "Translate the following text into German:\n\n",
  },
  "chat.starter.email": { de: "E-Mail formulieren", en: "Draft an email" },
  "chat.starter.emailPrompt": {
    de: "Formuliere eine professionelle E-Mail an einen Kunden über ",
    en: "Write a professional email to a customer about ",
  },
  "chat.starter.analyze": { de: "Text analysieren", en: "Analyse text" },
  "chat.starter.analyzePrompt": {
    de: "Analysiere den folgenden Text und fasse die Kernaussagen zusammen:\n\n",
    en: "Analyse the following text and summarise its key points:\n\n",
  },
  "chat.openSidebar": { de: "Sidebar öffnen", en: "Open sidebar" },
  "chat.temporary": { de: "Temporär", en: "Temporary" },
  "chat.manageTemp": { de: "Temporären Chat verwalten", en: "Manage temporary chat" },
  "chat.incognitoOn": {
    de: "Inkognito-Modus einschalten (temporärer Chat)",
    en: "Turn on incognito mode (temporary chat)",
  },
  "chat.keep": { de: "Chat behalten & speichern", en: "Keep & save chat" },
  "chat.deleteNow": { de: "Chat jetzt löschen", en: "Delete chat now" },
  "chat.info": {
    de: "Zu diesem Chat — Dateien, Markiertes, Notizen",
    en: "About this chat — files, starred, notes",
  },
  "chat.share": { de: "Chat teilen / exportieren", en: "Share / export chat" },
  "chat.linkCopied": { de: "Link kopiert!", en: "Link copied!" },
  "chat.copyShareLink": { de: "Share-Link kopieren", en: "Copy share link" },
  "chat.asMarkdown": { de: "Als Markdown", en: "As Markdown" },
  "chat.print": { de: "Drucken / PDF", en: "Print / PDF" },
  "chat.comingSoon": { de: "In Kürze verfügbar", en: "Coming soon" },
  "chat.exportPdf": { de: "Als PDF exportieren", en: "Export as PDF" },
  "chat.soon": { de: "bald", en: "soon" },
  "chat.tempNotSaved": {
    de: "Hinweis: Temporäre Chats werden nicht gespeichert.",
    en: "Note: temporary chats aren't saved.",
  },
  "chat.tempStart": { de: "Temporärer Chat — nichts wird gespeichert.", en: "Temporary chat — nothing is saved." },
  "chat.tempBanner": {
    de: "Temporärer Chat — wird nicht im Verlauf gespeichert und verschwindet beim Schließen.",
    en: "Temporary chat — not saved to your history and gone once you close it.",
  },
  "chat.pauseDiscussion": { de: "Diskussion pausieren", en: "Pause discussion" },
  "chat.panelWidth": { de: "Breite des Seitenbereichs", en: "Side panel width" },
  "chat.dragWidth": { de: "Breite ziehen", en: "Drag to resize" },
  "chat.discardTitle": { de: "Chat endgültig löschen?", en: "Delete chat permanently?" },
  "chat.discardBody": {
    de: "Dieser temporäre Chat wird unwiderruflich gelöscht.",
    en: "This temporary chat will be permanently deleted.",
  },

  // ── chat input ────────────────────────────────────────────────────────
  "input.placeholder": { de: "Stelle eine Frage…", en: "Ask anything…" },
  "input.hint": {
    de: "Enter zum Senden · Shift+Enter für Zeilenumbruch · „/“ für Vorlagen · 📎 für Dateien",
    en: "Enter to send · Shift+Enter for newline · “/” for templates · 📎 for files",
  },
  "input.cmdFile": { de: "Datei hochladen", en: "Upload file" },
  "input.cmdModel": { de: "Modell wählen", en: "Choose model" },
  "input.cmdSidekick": { de: "Sidekick wechseln / erstellen", en: "Switch / create sidekick" },
  "input.cmdSearch": { de: "Internetsuche umschalten", en: "Toggle web search" },
  "input.imageFailed": { de: "Bild konnte nicht verarbeitet werden.", en: "Couldn't process this image." },
  "input.fileFailed": { de: "Datei konnte nicht verarbeitet werden.", en: "Couldn't process this file." },
  "input.pickerModel": { de: "Modell wählen · ↑↓ · Tab/⏎ bestätigt", en: "Choose model · ↑↓ · Tab/⏎ to confirm" },
  "input.pickerCmds": {
    de: "Befehle & Vorlagen · ↑↓ · Tab/⏎ bestätigt",
    en: "Commands & templates · ↑↓ · Tab/⏎ to confirm",
  },
  "input.dropFiles": { de: "Dateien hier ablegen", en: "Drop files here" },
  "input.attach": { de: "Datei anhängen", en: "Attach file" },
  "input.web": { de: "Internetsuche", en: "Web search" },
  "input.webShort": { de: "Websuche", en: "Web" },
  "input.webOn": {
    de: "Internetsuche ist an — zum Ausschalten klicken",
    en: "Web search is on — click to turn it off",
  },
  "input.webOff": { de: "Internetsuche einschalten", en: "Turn on web search" },
  "input.kb": { de: "Wissensdatenbank", en: "Knowledge base" },
  "input.kbShort": { de: "Wissen", en: "Knowledge" },
  "input.kbOn": {
    de: "Wissensdatenbank ist an — zum Ausschalten klicken",
    en: "Knowledge base is on — click to turn it off",
  },
  "input.kbOff": { de: "Wissensdatenbank einschalten", en: "Turn on knowledge base" },
  "input.stop": { de: "Generierung stoppen", en: "Stop generating" },

  // ── chat message ──────────────────────────────────────────────────────
  "msg.generatedBy": { de: "Antwort erzeugt von {model}", en: "Response generated by {model}" },
  "msg.stats": { de: "{words} Wörter · ~{tokens} Tokens", en: "{words} words · ~{tokens} tokens" },
  "msg.ai": { de: "KI", en: "AI" },
  "msg.attachment": { de: "Anhang {n}", en: "Attachment {n}" },
  "msg.image": { de: "Bild {n}", en: "Image {n}" },
  "msg.star": { de: "Markieren (erscheint unter „Markiert“)", en: "Star (appears under “Starred”)" },
  "msg.unstar": { de: "Markierung entfernen", en: "Remove star" },
  "msg.thinking": { de: "Denkt nach…", en: "Thinking…" },
  "msg.reasoning": { de: "Denkprozess", en: "Reasoning" },
  "msg.pdfDoc": { de: "PDF-Dokument", en: "PDF document" },
  "msg.sheet": { de: "Excel-Tabelle", en: "Excel spreadsheet" },
  "msg.downloadPdf": { de: "PDF-Dokument herunterladen", en: "Download PDF document" },
  "msg.downloadSheet": { de: "Tabelle herunterladen", en: "Download spreadsheet" },
  "msg.sources": { de: "BookStack-Quellen", en: "BookStack sources" },
  "msg.prevVariant": { de: "Vorherige Variante", en: "Previous variant" },
  "msg.nextVariant": { de: "Nächste Variante", en: "Next variant" },
  "msg.regenerate": { de: "Neu generieren", en: "Regenerate" },
  "msg.readAloud": { de: "Vorlesen", en: "Read aloud" },
  "msg.good": { de: "Gute Antwort", en: "Good response" },
  "msg.bad": { de: "Schlechte Antwort", en: "Bad response" },

  // Auto-pipeline live status badges + hints.
  "pipeline.ocr": { de: "OCR-Modell analysiert Dokument…", en: "OCR model is analysing the document…" },
  "pipeline.answer": { de: "Allrounder formuliert Antwort…", en: "Allrounder is composing the answer…" },
  "pipeline.vision": { de: "Vision-Modell liest Dokument…", en: "Vision model is reading the document…" },
  "pipeline.coding": { de: "Coding-Modell arbeitet…", en: "Coding model is working…" },
  "pipeline.reasoning": { de: "Reasoning-Modell denkt nach…", en: "Reasoning model is thinking…" },
  "pipeline.text": { de: "Modell antwortet…", en: "Model is answering…" },
  "pipeline.imagegen": { de: "Erzeugt ein Bild…", en: "Generating an image…" },
  "pipeline.search": { de: "Durchsucht das Web…", en: "Searching the web…" },
  "pipeline.knowledge": { de: "Durchsucht die Wissensdatenbank…", en: "Searching the knowledge base…" },
  "pipeline.imagegenHint": {
    de: "🎨 Bildgenerierung ist noch nicht verfügbar. Dieses System kann Bilder lesen und analysieren, aber (noch) keine neuen Bilder erzeugen.",
    en: "🎨 Image generation is not available yet. This system can read and analyse images, but cannot (yet) create new ones.",
  },

  // ── model switcher ────────────────────────────────────────────────────
  "model.loading": { de: "Lade Modelle…", en: "Loading models…" },
  "model.none": { de: "Kein Modell", en: "No model" },
  "model.fav": { de: "Favorisieren", en: "Add to favourites" },
  "model.unfav": { de: "Favorit entfernen", en: "Remove from favourites" },
  "model.guest": { de: "Gast-Modell", en: "Guest model" },
  "model.guestLocked": { de: "Im Gast-Modus ist das Modell festgelegt.", en: "The model is fixed in guest mode." },
  "model.searchPh": { de: "Modell suchen…", en: "Search models…" },
  "model.search": { de: "Modell suchen", en: "Search models" },
  "model.reload": { de: "Modelle neu laden", en: "Reload models" },
  "model.autoHint": { de: "Bild→Vision · Doku→OCR · sonst Text", en: "Image→Vision · Doc→OCR · else Text" },
  "model.noModels": { de: "Keine Modelle.", en: "No models." },
  "model.noMatch": { de: "Keine Modelle gefunden.", en: "No models found." },
  "model.checkProviders": { de: "Provider prüfen", en: "Check providers" },
  "model.favorites": { de: "Favoriten", en: "Favourites" },

  // ── search / files / app ──────────────────────────────────────────────
  "search.noResults": { de: "Keine Treffer.", en: "No matches." },
  "search.recent": { de: "Zuletzt aktiv", en: "Recently active" },
  "files.title": { de: "Dateimanager", en: "File manager" },
  "files.empty": {
    de: "Noch keine Dateien. Hochgeladene und erzeugte Dateien erscheinen hier.",
    en: "No files yet. Files you upload or generate will appear here.",
  },
  "files.noChat": { de: "Ohne Chat", en: "No chat" },
  "files.generated": { de: "KI-generiert", en: "AI-generated" },
  "files.uploaded": { de: "Hochgeladen", en: "Uploaded" },
  "app.syncError": {
    de: "Serverspeicherung fehlgeschlagen — Änderungen evtl. nur lokal (Speicherplatz voll?).",
    en: "Couldn't save to the server — your changes may only be stored locally (is the disk full?).",
  },
  "app.retry": { de: "Erneut versuchen", en: "Try again" },
  "app.offline": {
    de: "Keine Verbindung. Änderungen werden gespeichert, sobald du wieder online bist.",
    en: "You're offline. Changes will be saved once you're back online.",
  },
  "app.copied": { de: "Antwort kopiert", en: "Response copied" },
  "chat.imageReady": { de: "Hier ist dein generiertes Bild:", en: "Here's your generated image:" },
  "chat.docReady": { de: "Hier ist dein fertiges Dokument. 📄", en: "Here's your finished document. 📄" },
  "input.pastedName": { de: "eingefügter_text", en: "pasted_text" },
  "input.fileOnly": { de: "(Datei angehängt)", en: "(File attached)" },
  "chat.scrollToLatest": { de: "Zur neuesten Nachricht", en: "Jump to latest message" },
  "shortcuts.title": { de: "Tastenkürzel", en: "Keyboard shortcuts" },
  "shortcuts.newChat": { de: "Neuer Chat", en: "New chat" },
  "shortcuts.search": { de: "Chats durchsuchen", en: "Search chats" },
  "shortcuts.toggleSidebar": { de: "Seitenleiste ein-/ausblenden", en: "Toggle sidebar" },
  "shortcuts.focusInput": { de: "Ins Eingabefeld springen", en: "Focus chat input" },
  "shortcuts.copyLast": { de: "Letzte Antwort kopieren", en: "Copy last response" },
  "shortcuts.newline": { de: "Neue Zeile", en: "New line" },
  "shortcuts.show": { de: "Tastenkürzel anzeigen", en: "Show shortcuts" },

  // ── settings shell ────────────────────────────────────────────────────
  "settings.newUpdates": { de: "Neue Updates", en: "New updates" },
  "settings.pickSection": { de: "Bereich wählen", en: "Choose section" },
  "settings.group.account": { de: "Konto", en: "Account" },
  "settings.group.personal": { de: "Personalisierung", en: "Personalisation" },
  "settings.group.features": { de: "Funktionen", en: "Features" },
  "settings.group.admin": { de: "Administration", en: "Administration" },
  "settings.group.system": { de: "System", en: "System" },
  "settings.tab.account": { de: "Mein Konto", en: "My account" },
  "settings.tab.appearance": { de: "Darstellung", en: "Appearance" },
  "settings.tab.chat": { de: "Chat", en: "Chat" },
  "settings.tab.assistant": { de: "Assistent", en: "Assistant" },
  "settings.tab.websearch": { de: "Websuche", en: "Web search" },
  "settings.tab.knowledge": { de: "Wissen", en: "Knowledge" },
  "settings.tab.data": { de: "Daten & Verlauf", en: "Data & history" },
  "settings.tab.admin-users": { de: "Benutzer & Zugriff", en: "Users & access" },
  "settings.tab.admin-login": { de: "Anmeldung & E-Mail", en: "Sign-in & email" },
  "settings.tab.admin-models": { de: "Modelle", en: "Models" },
  "settings.tab.admin-imagegen": { de: "Bildgenerierung", en: "Image generation" },
  "settings.tab.admin-integrations": { de: "Integrationen", en: "Integrations" },
  "settings.tab.admin-assistants": { de: "Assistenten & API", en: "Assistants & API" },
  "settings.tab.admin-branding": { de: "Marke", en: "Brand" },
  "settings.tab.admin-performance": { de: "Leistung", en: "Performance" },
  "settings.tab.about": { de: "Über {app}", en: "About {app}" },
  "settings.desc.account": {
    de: "Profil, Passwort und Zwei-Faktor-Authentifizierung.",
    en: "Profile, password and two-factor authentication.",
  },
  "settings.desc.appearance": { de: "Design und Sprache der Oberfläche.", en: "Interface theme and language." },
  "settings.desc.chat": {
    de: "Layout und Personalisierung des Chatverlaufs.",
    en: "Layout and personalisation of the chat view.",
  },
  "settings.desc.assistant": {
    de: "Wie sich das Modell verhält — Anweisungen, Vorlagen, Sidekicks, Gedächtnis.",
    en: "How the model behaves — instructions, templates, sidekicks, memory.",
  },
  "settings.desc.websearch": {
    de: "Aktuelle Informationen aus dem Web als Kontext für Antworten.",
    en: "Up-to-date information from the web as context for answers.",
  },
  "settings.desc.knowledge": {
    de: "Eigene Dokumente als durchsuchbare Wissensdatenbank.",
    en: "Your own documents as a searchable knowledge base.",
  },
  "settings.desc.data": {
    de: "Gespeicherte Unterhaltungen verwalten und löschen.",
    en: "Manage and delete saved conversations.",
  },
  "settings.desc.admin-users": {
    de: "Konten, Rollen und wer sich überhaupt anmelden darf.",
    en: "Accounts, roles and who may sign in at all.",
  },
  "settings.desc.admin-login": {
    de: "Single Sign-On und ausgehender E-Mail-Versand.",
    en: "Single sign-on and outgoing email.",
  },
  "settings.desc.admin-models": {
    de: "Anbieter, verfügbare Modelle und Standardzuordnungen.",
    en: "Providers, available models and default assignments.",
  },
  "settings.desc.admin-imagegen": {
    de: "Backend für die Bilderzeugung im Chat.",
    en: "Backend for image generation in chat.",
  },
  "settings.desc.admin-integrations": {
    de: "Externe Dienste und serverseitige Hintergrund-Dienste.",
    en: "External services and server-side background services.",
  },
  "settings.desc.admin-assistants": {
    de: "Die KI auf anderen Seiten einbetten — festes Modell, freigegebenes Wissen, Schlüssel.",
    en: "Embed the AI on other sites — pinned model, shared knowledge, keys.",
  },
  "settings.desc.admin-branding": {
    de: "Name, Logo, Farbe, Rechtliches und öffentliche Adresse dieser Instanz.",
    en: "Name, logo, colour, legal links and public address of this instance.",
  },
  "settings.desc.admin-performance": {
    de: "Wie die GPU zwischen mehreren Nutzern geteilt wird.",
    en: "How the GPU is shared between users.",
  },
  "settings.desc.about": { de: "Version und Änderungsverlauf.", en: "Version and changelog." },

  // ── account panel ─────────────────────────────────────────────────────
  "account.notSignedIn": { de: "Nicht angemeldet.", en: "Not signed in." },
  "account.signInVia": { de: "Anmeldung per {provider}", en: "Signs in with {provider}" },
  "account.signInPassword": { de: "Anmeldung per Passwort", en: "Signs in with a password" },
  "account.identity": { de: "Benutzername & E-Mail", en: "Username & email" },
  "account.domainHint": {
    de: "Die E-Mail-Adresse muss auf eine freigegebene Domain enden ({domains}). Dieselbe Vorgabe gilt für die Selbstregistrierung.",
    en: "The email address must end in an approved domain ({domains}). The same rule applies to self-registration.",
  },
  "account.managed": {
    de: "Dieses Konto wird vom Firmenverzeichnis verwaltet. Benutzername, Name und E-Mail werden bei jeder Anmeldung von dort übernommen.",
    en: "This account is managed by your company directory. Username, name and email are taken from there each time you sign in.",
  },
  "account.email": { de: "E-Mail", en: "Email" },
  "account.emailPh": { de: "name@firma.de", en: "name@company.com" },
  "account.namesByAdmin": {
    de: "Vor- und Nachname pflegt die Administration — melde eine Änderung dort.",
    en: "Your first and last name are managed by your administrators — ask them for changes.",
  },
  "account.saved": { de: "Gespeichert ✓", en: "Saved ✓" },
  "account.changePw": { de: "Passwort ändern", en: "Change password" },
  "account.curPw": { de: "Aktuelles Passwort", en: "Current password" },
  "account.newPw": { de: "Neues Passwort (min. 6)", en: "New password (min. 6)" },
  "account.pwChanged": { de: "Passwort geändert ✓", en: "Password changed ✓" },
  "account.2fa": { de: "Zwei-Faktor-Authentifizierung (TOTP)", en: "Two-factor authentication (TOTP)" },
  "account.2faActive": { de: "Aktiviert ✓", en: "Enabled ✓" },
  "account.2faDisable": { de: "Deaktivieren", en: "Turn off" },
  "account.2faEnable": { de: "Aktivieren", en: "Turn on" },
  "account.2faSetup": { de: "Einrichten", en: "Set up" },
  "account.2faSteps": {
    de: "Secret in Authenticator-App (Google Authenticator, Authy…) eintragen, dann Code bestätigen:",
    en: "Add the secret to your authenticator app (Google Authenticator, Authy…), then confirm the code:",
  },
  "account.otpLink": { de: "otpauth-Link öffnen", en: "Open otpauth link" },
  "account.2faOn": { de: "2FA aktiviert ✓", en: "2FA enabled ✓" },
  "account.2faOff": { de: "2FA deaktiviert", en: "2FA disabled" },
  "account.err.identity": {
    de: "Benutzername und E-Mail wurden nicht gespeichert. Prüfe die Eingaben und versuche es erneut.",
    en: "Your username and email weren't saved. Check your entries and try again.",
  },
  "account.err.pwShort": {
    de: "Passwort wurde nicht geändert: Das neue Passwort braucht mindestens 6 Zeichen.",
    en: "Password not changed: the new password needs at least 6 characters.",
  },
  "account.err.pw": {
    de: "Passwort wurde nicht geändert. Prüfe dein aktuelles Passwort und versuche es erneut.",
    en: "Password not changed. Check your current password and try again.",
  },
  "account.err.2faStart": {
    de: "Die 2FA-Einrichtung konnte nicht gestartet werden. Versuche es erneut.",
    en: "Couldn't start 2FA setup. Please try again.",
  },
  "account.err.2faCode": {
    de: "2FA wurde nicht aktiviert. Gib den aktuellen 6-stelligen Code aus deiner Authenticator-App ein.",
    en: "2FA wasn't turned on. Enter the current 6-digit code from your authenticator app.",
  },
  "account.err.2faOff": {
    de: "2FA wurde nicht deaktiviert. Versuche es erneut.",
    en: "2FA wasn't turned off. Please try again.",
  },

  // ── login / reset / setup ─────────────────────────────────────────────
  "login.ssoFallback": { de: "Mit Microsoft-Geschäftskonto anmelden", en: "Sign in with your Microsoft work account" },
  "login.sso.sso_not_configured": {
    de: "Die Microsoft-Anmeldung ist nicht konfiguriert.",
    en: "Microsoft sign-in isn't set up.",
  },
  "login.sso.sso": { de: "Die Microsoft-Anmeldung ist fehlgeschlagen.", en: "Microsoft sign-in failed." },
  "login.sso.sso_state": {
    de: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.",
    en: "Security check failed. Please try again.",
  },
  "login.sso.sso_token": { de: "Token-Austausch fehlgeschlagen.", en: "Token exchange failed." },
  "login.sso.sso_claims": {
    de: "Kein Benutzername vom Identity-Provider erhalten.",
    en: "The identity provider didn't return a username.",
  },
  "login.sso.sso_tenant": {
    de: "Dieser Account gehört nicht zur zugelassenen Organisation.",
    en: "This account doesn't belong to the permitted organisation.",
  },
  "login.failed": { de: "Anmeldung fehlgeschlagen.", en: "Sign-in failed." },
  "login.err.credentials": {
    de: "Benutzername oder Passwort stimmt nicht. Prüfe deine Eingabe und versuche es erneut.",
    en: "Username or password is incorrect. Check your entry and try again.",
  },
  "login.err.login": {
    de: "Anmeldung nicht möglich. Versuche es erneut oder wende dich an die Administration.",
    en: "Couldn't sign you in. Try again or contact your administrator.",
  },
  "login.err.code": {
    de: "Der Code wurde nicht akzeptiert. Gib den aktuellen 6-stelligen Code aus deiner Authenticator-App ein.",
    en: "That code wasn't accepted. Enter the current 6-digit code from your authenticator app.",
  },
  "login.err.register": {
    de: "Konto wurde nicht erstellt. Prüfe Benutzername und Passwort (mind. 6 Zeichen) und versuche es erneut.",
    en: "Your account wasn't created. Check your username and password (at least 6 characters) and try again.",
  },
  "login.title2fa": { de: "Bestätige mit deinem Authenticator-Code", en: "Confirm with your authenticator code" },
  "login.titleReset": { de: "Passwort zurücksetzen", en: "Reset password" },
  "login.titleRegister": { de: "Konto erstellen", en: "Create account" },
  "login.codeLabel": { de: "Authenticator-Code", en: "Authenticator code" },
  "login.forgotSent": {
    de: "Falls ein Konto mit dieser Angabe existiert, wurde ein Link zum Zurücksetzen des Passworts per E-Mail verschickt. Prüfe dein Postfach (auch Spam).",
    en: "If an account matches what you entered, we've emailed a link to reset your password. Check your inbox (and spam folder).",
  },
  "login.backToLogin": { de: "Zurück zur Anmeldung", en: "Back to sign-in" },
  "login.forgotHint": {
    de: "Gib deinen Benutzernamen oder deine E-Mail ein — wir senden dir einen Link zum Zurücksetzen.",
    en: "Enter your username or email — we'll send you a reset link.",
  },
  "login.userOrEmail": { de: "Benutzername oder E-Mail", en: "Username or email" },
  "login.requestLink": { de: "Link anfordern", en: "Send link" },
  "login.emailAddress": { de: "E-Mail-Adresse", en: "Email address" },
  "login.domainOnly": {
    de: "Registrierung nur mit einer erlaubten Domain: {domains}",
    en: "Registration is limited to these domains: {domains}",
  },
  "login.register": { de: "Registrieren", en: "Register" },
  "login.or": { de: "oder", en: "or" },
  "login.noAccount": { de: "Noch kein Konto? Registrieren", en: "No account yet? Register" },
  "login.haveAccount": { de: "Schon ein Konto? Anmelden", en: "Already have an account? Sign in" },
  "login.forgot": { de: "Passwort vergessen?", en: "Forgot password?" },
  "login.adminLogin": { de: "Administrator-Anmeldung", en: "Administrator sign-in" },
  "reset.done": {
    de: "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.",
    en: "Your password has been changed. You can sign in now.",
  },
  "reset.toLogin": { de: "Zur Anmeldung", en: "Go to sign-in" },
  "reset.invalid": {
    de: "Kein gültiger Reset-Link. Fordere über die Anmeldeseite einen neuen an.",
    en: "This reset link isn't valid. Request a new one from the sign-in page.",
  },
  "reset.newPw": { de: "Neues Passwort", en: "New password" },
  "reset.newPwPh": { de: "Neues Passwort (min. 8 Zeichen)", en: "New password (min. 8 characters)" },
  "reset.confirmPw": { de: "Passwort bestätigen", en: "Confirm password" },
  "reset.tooShort": {
    de: "Passwort muss mindestens 8 Zeichen lang sein.",
    en: "Password must be at least 8 characters long.",
  },
  "reset.mismatch": { de: "Passwörter stimmen nicht überein.", en: "Passwords don't match." },
  "reset.submit": { de: "Passwort setzen", en: "Set password" },
  "reset.err": {
    de: "Passwort wurde nicht zurückgesetzt. Der Link ist evtl. abgelaufen — fordere über die Anmeldeseite einen neuen an.",
    en: "Your password wasn't reset. The link may have expired — request a new one from the sign-in page.",
  },
  "setup.welcome": { de: "Willkommen bei {app}", en: "Welcome to {app}" },
  "setup.intro": {
    de: "Ersteinrichtung — lege das Admin-Konto und die Server-Daten fest.",
    en: "First-time setup — create the admin account and enter the server details.",
  },
  "setup.admin": { de: "Admin-Konto", en: "Admin account" },
  "setup.adminUser": { de: "Admin-Benutzername", en: "Admin username" },
  "setup.pwPh": { de: "Passwort (min. 8 Zeichen)", en: "Password (min. 8 characters)" },
  "setup.server": { de: "Server-Daten", en: "Server details" },
  "setup.instance": { de: "Instanz-Name", en: "Instance name" },
  "setup.instancePh": { de: "Instanz-Name (z. B. Musterfirma Chat)", en: "Instance name (e.g. Acme Chat)" },
  "setup.logo": { de: "Logo (optional)", en: "Logo (optional)" },
  "setup.logoReplace": { de: "Logo ersetzen", en: "Replace logo" },
  "setup.badImage": { de: "Bild ungültig.", en: "Invalid image." },
  "setup.accent": { de: "Akzentfarbe", en: "Accent colour" },
  "setup.ollama": { de: "Ollama (lokal)", en: "Ollama (local)" },
  "setup.openai": { de: "OpenAI-kompatibel", en: "OpenAI-compatible" },
  "setup.apiKey": { de: "API-Key", en: "API key" },
  "setup.finish": { de: "Einrichtung abschließen", en: "Finish setup" },
  "setup.err": {
    de: "Einrichtung fehlgeschlagen. Prüfe die Angaben und versuche es erneut.",
    en: "Setup failed. Check your entries and try again.",
  },

  // ── shared (fork A) ───────────────────────────────────────────────────
  "common.error": { de: "Fehler", en: "Something went wrong." },

  // ── admin: users ──────────────────────────────────────────────────────
  "admin.users.kind.user": { de: "Konto", en: "Account" },
  "admin.users.kind.guest": { de: "Gast", en: "Guest" },
  "admin.users.kind.assistant": { de: "Assistent", en: "Assistant" },
  "admin.users.since.now": { de: "jetzt", en: "now" },
  "admin.users.since.s": { de: "vor {n} s", en: "{n}s ago" },
  "admin.users.since.min": { de: "vor {n} Min", en: "{n} min ago" },
  "admin.users.since.h": { de: "vor {n} Std", en: "{n} h ago" },
  "admin.users.since.d": { de: "vor {n} Tg", en: "{n} d ago" },
  "admin.users.uaUnknown": { de: "unbekannt", en: "unknown" },
  "admin.users.uaOther": { de: "anderer", en: "other" },
  "admin.users.err.names": { de: "Vor- und Nachname erforderlich.", en: "First and last name are required." },
  "admin.users.err.credentials": {
    de: "Benutzername und Passwort (min. 6 Zeichen) nötig.",
    en: "Enter a username and a password with at least 6 characters.",
  },
  "admin.users.err.pwShort": {
    de: "Passwort muss mindestens 6 Zeichen haben.",
    en: "Password not reset: it needs at least 6 characters.",
  },
  "admin.users.resetPrompt": {
    de: "Neues Passwort für \"{name}\" (min. 6 Zeichen):",
    en: "New password for \"{name}\" (min. 6 characters):",
  },
  "admin.users.deleteTitle": { de: "Benutzer „{name}“ löschen?", en: "Delete user “{name}”?" },
  "admin.users.deleteMsg": { de: "Das Konto wird dauerhaft entfernt.", en: "The account will be removed permanently." },
  "admin.users.sessions": { de: "Aktive Sitzungen", en: "Active sessions" },
  "admin.users.sessionsTip": {
    de: "Wer in den letzten zwei Minuten eine Anfrage gestellt hat. Diese Angaben liegen ausschließlich im Arbeitsspeicher dieses Servers, werden nicht in data/ geschrieben und sind nach einem Neustart weg. Eine Zeile je Gerät bzw. Browser.",
    en: "Who made a request in the last two minutes. This is kept only in this server's memory, never written to data/, and is gone after a restart. One row per device or browser.",
  },
  "admin.users.sessionsEmpty": {
    de: "Gerade niemand aktiv. Angemeldete Clients melden sich alle 20 Sekunden.",
    en: "Nobody is active right now. Signed-in clients check in every 20 seconds.",
  },
  "admin.users.title": { de: "Benutzer", en: "Users" },
  "admin.users.intro": {
    de: "Rollen vergeben, Konten sperren, Passwörter zurücksetzen oder löschen.",
    en: "Assign roles, block accounts, reset passwords or delete users.",
  },
  "admin.users.firstName": { de: "Vorname", en: "First name" },
  "admin.users.lastName": { de: "Nachname", en: "Last name" },
  "admin.users.emailPh": { de: "E-Mail (optional, für Passwort-Reset)", en: "Email (optional, for password reset)" },
  "admin.users.create": { de: "Anlegen", en: "Create" },
  "admin.users.searchPh": {
    de: "Nach Name, Benutzername oder E-Mail suchen…",
    en: "Search by name, username or email…",
  },
  "admin.users.none": { de: "Keine Benutzer gefunden.", en: "No users found." },
  "admin.users.activeNow": { de: "gerade aktiv", en: "active now" },
  "admin.users.lastSeen": { de: "zuletzt {when}", en: "last seen {when}" },
  "admin.users.notSeen": { de: "seit dem letzten Neustart nicht gesehen", en: "not seen since the last restart" },
  "admin.users.blocked": { de: "gesperrt", en: "blocked" },
  "admin.users.role": { de: "Rolle", en: "Role" },
  "admin.users.editTitle": {
    de: "Name, Benutzername und E-Mail bearbeiten",
    en: "Edit name, username and email",
  },
  "admin.users.editNamed": { de: "{name} bearbeiten", en: "Edit {name}" },
  "admin.users.2faTitle": { de: "2FA für „{name}“ abschalten?", en: "Turn off 2FA for “{name}”?" },
  "admin.users.2faMsg": {
    de: "Nötig, wenn der Authenticator verloren ist.",
    en: "Needed when the authenticator has been lost.",
  },
  "admin.users.2faOff": { de: "Abschalten", en: "Turn off" },
  "admin.users.2faActive": { de: "2FA aktiv — zum Zurücksetzen klicken", en: "2FA on — click to reset" },
  "admin.users.2faReset": { de: "2FA für {name} zurücksetzen", en: "Reset 2FA for {name}" },
  "admin.users.resetPwNamed": { de: "Passwort von {name} zurücksetzen", en: "Reset password for {name}" },
  "admin.users.block": { de: "Sperren", en: "Block" },
  "admin.users.unblock": { de: "Entsperren", en: "Unblock" },
  "admin.users.blockNamed": { de: "{name} sperren", en: "Block {name}" },
  "admin.users.unblockNamed": { de: "{name} entsperren", en: "Unblock {name}" },
  "admin.users.kbAll": { de: "Wissenszugriff: alle Kategorien (Admin)", en: "Knowledge access: all categories (admin)" },
  "admin.users.kb": { de: "Wissenszugriff:", en: "Knowledge access:" },
  "admin.users.editAccount": { de: "Konto bearbeiten", en: "Edit account" },
  "admin.users.firstNameHint": {
    de: "Der Vorname bestimmt, wie die App den Nutzer anspricht.",
    en: "The first name is how the app addresses this user.",
  },
  "admin.users.managed": {
    de: "Konto aus dem Firmenverzeichnis: Änderungen hier werden bei der nächsten Anmeldung von dort überschrieben.",
    en: "Account from the company directory: changes made here are overwritten from there at the next sign-in.",
  },
  "admin.users.displayName": { de: "Anzeigename", en: "Display name" },
  "admin.users.displayNameTip": {
    de: "Optional. Leer lassen — dann wird er aus Vor- und Nachnamen gebildet und bleibt automatisch aktuell.",
    en: "Optional. Leave empty to build it from the first and last name and keep it up to date automatically.",
  },
  "admin.users.builtinTip": {
    de: "Der Built-in-Administrator kann nicht umbenannt werden — er ist der garantierte Wiederherstellungszugang.",
    en: "The built-in administrator can't be renamed — it's the guaranteed recovery account.",
  },
  "admin.users.emailTip": {
    de: "Wird für den Passwort-Reset per E-Mail benötigt. Leer = entfernen.",
    en: "Needed for password reset by email. Empty = remove.",
  },

  // ── admin: access ─────────────────────────────────────────────────────
  "admin.access.title": { de: "Registrierung & Gastzugang", en: "Registration & guest access" },
  "admin.access.intro": {
    de: "Welche Anmeldearten verfügbar sind, wer sich registrieren darf, und ob nicht angemeldete Gäste den Chatbot testen können.",
    en: "Which sign-in methods are available, who may register, and whether guests can try the chatbot without signing in.",
  },
  "admin.access.methods": { de: "Anmeldearten", en: "Sign-in methods" },
  "admin.access.password": {
    de: "Passwort-Anmeldung erlauben (Benutzername & Passwort)",
    en: "Allow password sign-in (username & password)",
  },
  "admin.access.passwordTip": {
    de: "Erlaubt die klassische Anmeldung mit Benutzername und Passwort. Ausschalten für reinen SSO-Betrieb — der Administrator kann sich dann weiterhin per Passwort anmelden.",
    en: "Allows classic sign-in with username and password. Turn off for SSO-only — the administrator can still sign in with a password.",
  },
  "admin.access.passwordOff": {
    de: "Nutzer melden sich nur mit dem Microsoft-Geschäftskonto an. Der Administrator kann sich weiterhin per Passwort anmelden (Wiederherstellung).",
    en: "Users sign in only with their Microsoft work account. The administrator can still sign in with a password (recovery).",
  },
  "admin.access.sso": {
    de: "Anmeldung mit Microsoft-Geschäftskonto (Entra ID / SSO) erlauben",
    en: "Allow sign-in with a Microsoft work account (Entra ID / SSO)",
  },
  "admin.access.ssoTip": {
    de: "Zeigt den Anmelde-Button für das Microsoft-Geschäftskonto. Die Zugangsdaten (Entra ID oder ein anderer OIDC-Server wie ADFS/Keycloak) richtest du im Abschnitt „Microsoft-Anmeldung (SSO)“ weiter unten ein; dort lässt sich auch die Beschriftung ändern.",
    en: "Shows the sign-in button for Microsoft work accounts. Set up the credentials (Entra ID or another OIDC server such as ADFS/Keycloak) in the “Microsoft sign-in (SSO)” section below; you can also change the button label there.",
  },
  "admin.access.ssoMissing": {
    de: "SSO ist noch nicht konfiguriert — der Button bleibt inaktiv, bis du die Zugangsdaten unter „Microsoft-Anmeldung (SSO)“ hinterlegst.",
    en: "SSO isn't set up yet — the button stays inactive until you enter the credentials under “Microsoft sign-in (SSO)”.",
  },
  "admin.access.noMethod": {
    de: "Achtung: Keine Anmeldeart aktiv. Nur der Administrator kann sich noch (per Passwort) anmelden.",
    en: "Warning: no sign-in method is on. Only the administrator can still sign in (with a password).",
  },
  "admin.access.reset": {
    de: "„Passwort vergessen?“ im Login anzeigen (Self-Service-Reset)",
    en: "Show “Forgot password?” on the sign-in page (self-service reset)",
  },
  "admin.access.resetTip": {
    de: "Zeigt auf der Anmeldeseite einen „Passwort vergessen?“-Link. Nutzer bekommen dann per E-Mail einen Link, um ihr Passwort selbst zurückzusetzen. Setzt einen konfigurierten E-Mail-Versand und eine hinterlegte E-Mail-Adresse beim Nutzer voraus.",
    en: "Shows a “Forgot password?” link on the sign-in page. Users then get an email link to reset their password themselves. Requires outgoing email to be set up and an email address on the user's account.",
  },
  "admin.access.smtpMissing": {
    de: "Noch kein E-Mail-Versand konfiguriert — der Link erscheint auf der Anmeldeseite erst, wenn unter „Anmeldung & E-Mail“ → „E-Mail-Versand“ die Zugangsdaten hinterlegt sind.",
    en: "Outgoing email isn't set up yet — the link only appears on the sign-in page once credentials are entered under “Sign-in & email” → “Outgoing email”.",
  },
  "admin.access.selfReg": {
    de: "Selbstregistrierung erlauben (zeigt „Registrieren“ auf der Login-Seite)",
    en: "Allow self-registration (shows “Register” on the sign-in page)",
  },
  "admin.access.selfRegTip": {
    de: "Erlaubt Besuchern, sich selbst ein Konto anzulegen. Aus = nur der Admin legt Konten an (Benutzerverwaltung oben).",
    en: "Lets visitors create their own account. Off = only the admin creates accounts (user management above).",
  },
  "admin.access.domains": {
    de: "Erlaubte E-Mail-Domains (optional, eine pro Zeile). Leer = alle Domains.",
    en: "Allowed email domains (optional, one per line). Empty = all domains.",
  },
  "admin.access.domainsTip": {
    de: "Beschränkt die Selbstregistrierung auf bestimmte E-Mail-Domains (z. B. firma.de). Der Benutzername muss dann eine E-Mail dieser Domain sein.",
    en: "Limits self-registration to specific email domains (e.g. company.com). The username must then be an email address on one of these domains.",
  },
  "admin.access.domainsPh": { de: "firma.de\nfirma.com", en: "company.com\ncompany.co.uk" },
  "admin.access.guest": {
    de: "Gast-Zugang erlauben (Nutzung ohne Anmeldung)",
    en: "Allow guest access (use without signing in)",
  },
  "admin.access.guestTip": {
    de: "Nicht angemeldete Besucher dürfen den Chatbot mit genau einem festgelegten Modell testen. Ideal zum Ausprobieren ohne Konto.",
    en: "Visitors who aren't signed in may try the chatbot with exactly one fixed model. Ideal for trying it out without an account.",
  },
  "admin.access.guestModel": {
    de: "Gast-Modell (das einzige Modell, das Gäste nutzen dürfen)",
    en: "Guest model (the only model guests may use)",
  },
  "admin.access.pickModel": { de: "— Modell wählen —", en: "— Choose model —" },
  "admin.access.reloadModels": { de: "Modelle neu laden", en: "Reload models" },
  "admin.access.guestNoModel": {
    de: "Ohne gewähltes Gast-Modell bleibt der Gast-Zugang inaktiv.",
    en: "Guest access stays inactive until you choose a guest model.",
  },

  // ── admin: roles ──────────────────────────────────────────────────────
  "roles.title": { de: "Rollen & Rechte", en: "Roles & permissions" },
  "roles.intro": {
    de: "Eigene Rollen anlegen und Rechte per Checkbox vergeben.",
    en: "Create custom roles and grant permissions with checkboxes.",
  },
  "roles.delete": { de: "Rolle löschen", en: "Delete role" },
  "roles.new": { de: "Neue Rolle", en: "New role" },
  "roles.namePh": { de: "Rollenname…", en: "Role name…" },
  "roles.save": { de: "Rolle speichern", en: "Save role" },
  "roles.create": { de: "Rolle erstellen", en: "Create role" },
  // Keys mirror lib/permissions.ts PERMISSIONS[].key — keep them in sync.
  "roles.perm.models.pull": { de: "Darf Modelle pullen", en: "Can pull models" },
  "roles.perm.models.pull.desc": { de: "Neue Modelle vom Ollama-Server laden.", en: "Download new models to the Ollama server." },
  "roles.perm.models.delete": { de: "Darf Modelle löschen", en: "Can delete models" },
  "roles.perm.models.delete.desc": {
    de: "Installierte Modelle vom Server entfernen.",
    en: "Remove installed models from the server.",
  },
  "roles.perm.workspaces.create": { de: "Darf Workspaces erstellen", en: "Can create workspaces" },
  "roles.perm.workspaces.create.desc": { de: "Neue Kollaborationsräume anlegen.", en: "Set up new collaboration spaces." },
  "roles.perm.workspaces.delete": { de: "Darf Workspaces löschen", en: "Can delete workspaces" },
  "roles.perm.workspaces.delete.desc": {
    de: "Workspaces samt Zuordnung entfernen.",
    en: "Remove workspaces along with their assignments.",
  },
  "roles.perm.files.share": { de: "Darf Dokumente teilen", en: "Can share documents" },
  "roles.perm.files.share.desc": {
    de: "Dateien in Workspaces mit anderen teilen.",
    en: "Share files with others in workspaces.",
  },
  "roles.perm.chats.share": { de: "Darf Chats teilen", en: "Can share chats" },
  "roles.perm.chats.share.desc": { de: "Öffentliche Chat-Freigabe-Links erzeugen.", en: "Create public chat share links." },
  "roles.perm.users.manage": { de: "Darf Benutzer verwalten", en: "Can manage users" },
  "roles.perm.users.manage.desc": {
    de: "Konten anlegen, sperren, Rollen zuweisen.",
    en: "Create and block accounts, assign roles.",
  },
  "roles.perm.roles.manage": { de: "Darf Rollen verwalten", en: "Can manage roles" },
  "roles.perm.roles.manage.desc": {
    de: "Eigene Rollen erstellen und Rechte vergeben.",
    en: "Create custom roles and grant permissions.",
  },
  "roles.perm.terminal.access": { de: "Darf Server-Terminal nutzen", en: "Can use the server terminal" },
  "roles.perm.terminal.access.desc": {
    de: "Admin-Terminal / Ollama-Befehle ausführen.",
    en: "Run admin terminal / Ollama commands.",
  },

  // ── chat participants ─────────────────────────────────────────────────
  "participants.button": { de: "Nutzer einladen / Teilnehmer verwalten", en: "Invite / manage participants" },
  "participants.title": { de: "Teilnehmer verwalten", en: "Manage participants" },
  "participants.intro": {
    de: "Lade mehrere Sidekicks in diesen Chat ein. Bei mehr als einem wird der Chat zum Konferenzraum.",
    en: "Invite several sidekicks to this chat. With more than one, the chat becomes a conference room.",
  },
  "participants.empty": {
    de: "Noch keine Sidekicks. Lege welche unter Einstellungen → KI-Personalisierung an.",
    en: "No sidekicks yet. Create some under Settings → AI personalisation.",
  },
  "participants.moderation": { de: "Automatische Moderation", en: "Automatic moderation" },
  "participants.moderationHint": {
    de: "Ein Moderator-Modell wählt vor jedem Beitrag den passendsten Sidekick (statt fester Reihenfolge).",
    en: "A moderator model picks the best-suited sidekick before each turn (instead of a fixed order).",
  },

  // ── shared (fork B) ───────────────────────────────────────────────────
  "common.failed": { de: "Fehlgeschlagen.", en: "That didn't work. Try again." },
  "common.errorRetry": { de: "Fehler.", en: "Something went wrong. Try again." },
  "common.reload": { de: "Neu laden", en: "Reload" },

  // ── admin: embedded assistants ────────────────────────────────────────
  "admin.assistants.never": { de: "nie", en: "never" },
  "admin.assistants.justNow": { de: "gerade", en: "just now" },
  "admin.assistants.minAgo": { de: "vor {n} Min", en: "{n} min ago" },
  "admin.assistants.hoursAgo": { de: "vor {n} Std", en: "{n} h ago" },
  "admin.assistants.daysAgo": { de: "vor {n} Tg", en: "{n} d ago" },
  "admin.assistants.defaultName": { de: "Neuer Assistent", en: "New assistant" },
  "admin.assistants.intro": {
    de: "Ein Assistent ist ein Zugang für fremde Seiten: festes Modell, eigener System-Prompt und genau die Wissensbereiche, die du freigibst. Assistenten sind keine Benutzerkonten — Chats, Profile und die Verwaltung bleiben ihnen verschlossen.",
    en: "An assistant is an access point for other websites: a pinned model, its own system prompt and exactly the knowledge areas you share. Assistants are not user accounts — chats, profiles and administration stay closed to them.",
  },
  "admin.assistants.active": { de: "aktiv", en: "active" },
  "admin.assistants.inactive": { de: "deaktiviert", en: "disabled" },
  "admin.assistants.create": { de: "Assistent anlegen", en: "Create assistant" },
  "admin.assistants.empty": { de: "Noch kein Assistent angelegt.", en: "No assistants yet." },
  "admin.assistants.name": { de: "Name", en: "Name" },
  "admin.assistants.model": { de: "Modell (fest)", en: "Model (pinned)" },
  "admin.assistants.modelInfo": {
    de: "Der Aufrufer kann das Modell nicht wählen. Ein im Request mitgeschicktes „model“ wird ignoriert.",
    en: "The caller can't choose the model. A “model” sent with the request is ignored.",
  },
  "admin.assistants.choose": { de: "— wählen —", en: "— choose —" },
  "admin.assistants.reloadModels": { de: "Modelle neu laden", en: "Reload models" },
  "admin.assistants.systemPrompt": { de: "System-Prompt", en: "System prompt" },
  "admin.assistants.systemPromptInfo": {
    de: "Rolle und Tonfall des Assistenten. Der interne App-Prompt gilt hier absichtlich nicht.",
    en: "The assistant's role and tone. The app's internal prompt deliberately doesn't apply here.",
  },
  "admin.assistants.systemPromptPlaceholder": {
    de: "Du bist der Support-Assistent der Musterfirma. Antworte knapp und belege jede Aussage mit der Quelle.",
    en: "You are the support assistant of Example Corp. Answer briefly and back every statement with its source.",
  },
  "admin.assistants.greeting": { de: "Begrüßung im Widget", en: "Widget greeting" },
  "admin.assistants.greetingPlaceholder": {
    de: "Hallo! Frag mich etwas zu unseren Produkten.",
    en: "Hi! Ask me anything about our products.",
  },
  "admin.assistants.knowledge": { de: "Wissen", en: "Knowledge" },
  "admin.assistants.knowledgeHint": {
    de: "Ohne Auswahl hat der Assistent keinen Zugriff auf Dokumente — das ist die Voreinstellung.",
    en: "With nothing selected the assistant has no access to documents — that's the default.",
  },
  "admin.assistants.noCategories": {
    de: "Noch keine Kategorien in der Wissensdatenbank.",
    en: "No categories in the knowledge base yet.",
  },
  "admin.assistants.bookstack": { de: "BookStack-Wiki nutzen", en: "Use BookStack wiki" },
  "admin.assistants.bookstackInfo": {
    de: "Nur die unten gewählten Bücher werden durchsucht. Ohne Buchauswahl findet der Assistent nichts.",
    en: "Only the books selected below are searched. With no books selected the assistant finds nothing.",
  },
  "admin.assistants.noBooks": {
    de: "Keine Bücher gefunden (BookStack nicht erreichbar?).",
    en: "No books found. Check that BookStack is reachable.",
  },
  "admin.assistants.webSearch": { de: "Web-Suche erlauben", en: "Allow web search" },
  "admin.assistants.webSearchInfo": {
    de: "Jede fremde Anfrage kann dann Credits beim Suchanbieter kosten.",
    en: "Every outside request may then use credits with the search provider.",
  },
  "admin.assistants.showSources": { de: "Quellen anzeigen", en: "Show sources" },
  "admin.assistants.enabled": { de: "Aktiv", en: "Active" },
  "admin.assistants.enabledInfo": {
    de: "Deaktiviert lehnt der Assistent jeden Aufruf ab, ohne dass Schlüssel widerrufen werden müssen.",
    en: "When disabled the assistant rejects every call, without having to revoke keys.",
  },
  "admin.assistants.perMinute": { de: "Anfragen / Minute", en: "Requests / minute" },
  "admin.assistants.perDayPerIp": { de: "Anfragen / Tag / IP", en: "Requests / day / IP" },
  "admin.assistants.perDay": { de: "Anfragen / Tag (gesamt)", en: "Requests / day (total)" },
  "admin.assistants.maxInputChars": { de: "Max. Zeichen je Anfrage", en: "Max. characters per request" },
  "admin.assistants.maxHistory": { de: "Verlaufstiefe", en: "History depth" },
  "admin.assistants.maxTokens": { de: "Max. Tokens je Antwort", en: "Max. tokens per response" },
  "admin.assistants.origins": { de: "Erlaubte Herkunft (eine je Zeile)", en: "Allowed origins (one per line)" },
  "admin.assistants.originsInfo": {
    de: "Gilt nur für Widget-Schlüssel. Genau die Adresse der einbettenden Seite, z. B. https://intranet.firma.de — ohne Pfad.",
    en: "Applies to widget keys only. The exact address of the embedding site, e.g. https://intranet.example.com — without a path.",
  },
  "admin.assistants.keys": { de: "Schlüssel", en: "Keys" },
  "admin.assistants.keysHint": {
    de: "Der geheime Schlüssel gehört in ein fremdes Backend, der Widget-Schlüssel in eine Webseite. Beide werden nur als Hash gespeichert — der Klartext erscheint genau einmal.",
    en: "The secret key belongs in another backend, the widget key in a web page. Both are stored only as a hash — the plain text is shown exactly once.",
  },
  "admin.assistants.freshKey": {
    de: "Neuer Schlüssel — jetzt kopieren, er wird nicht wieder angezeigt:",
    en: "New key — copy it now, it won't be shown again:",
  },
  "admin.assistants.noKeys": { de: "Noch kein Schlüssel.", en: "No keys yet." },
  "admin.assistants.keySecret": { de: "Geheim", en: "Secret" },
  "admin.assistants.keyWidget": { de: "Widget", en: "Widget" },
  "admin.assistants.lastUsed": { de: "zuletzt {when}", en: "last used {when}" },
  "admin.assistants.revoked": { de: "widerrufen", en: "revoked" },
  "admin.assistants.revoke": { de: "Widerrufen", en: "Revoke" },
  "admin.assistants.mintSecret": { de: "Geheimen Schlüssel erzeugen", en: "Create secret key" },
  "admin.assistants.mintPublic": { de: "Widget-Schlüssel erzeugen", en: "Create widget key" },
  "admin.assistants.embed": { de: "Einbettung", en: "Embed code" },
  "admin.assistants.noAppUrl": {
    de: "Setze die öffentliche App-URL unter Marke, damit hier die echte Adresse steht.",
    en: "Set the public app URL under Brand so the real address appears here.",
  },
  "admin.assistants.usage": {
    de: "{requests} Anfragen insgesamt · {today} heute · {denied} abgewiesen · zuletzt {when}",
    en: "{requests} requests in total · {today} today · {denied} rejected · last {when}",
  },
  "admin.assistants.usagePrivacy": {
    de: "Es werden ausschließlich Zähler gespeichert, keine Gesprächsinhalte.",
    en: "Only counters are stored, never conversation content.",
  },
  "admin.assistants.confirmDelete": { de: "„{name}\" löschen?", en: "Delete “{name}”?" },
  "admin.assistants.confirmDeleteBody": {
    de: "Alle Schlüssel dieses Assistenten werden ungültig. Eingebettete Seiten hören sofort auf zu funktionieren.",
    en: "All keys of this assistant become invalid. Embedded pages stop working immediately.",
  },

  // ── admin: server terminal ────────────────────────────────────────────
  "admin.terminal.welcome": { de: "{app} Admin-Terminal — tippe \"help\".", en: "{app} admin terminal — type \"help\"." },
  "admin.terminal.aborted": { de: "^C abgebrochen", en: "^C cancelled" },
  "admin.terminal.title": { de: "Server-Terminal", en: "Server terminal" },
  "admin.terminal.badge": { de: "nur Admin · nur Ollama", en: "admin only · Ollama only" },
  "admin.terminal.clear": { de: "Leeren", en: "Clear" },
  "admin.terminal.placeholder": { de: "z. B. \"ollama list\"", en: "e.g. \"ollama list\"" },
  "admin.terminal.abort": { de: "Abbrechen (^C)", en: "Cancel (^C)" },
  "admin.terminal.run": { de: "Ausführen (⏎)", en: "Run (⏎)" },
  "admin.terminal.noServer": {
    de: "Kein Ollama-Server gewählt — ollama-Befehle brauchen einen Server.",
    en: "No Ollama server selected — ollama commands need a server. Choose one above.",
  },

  // ── admin: Ollama models (pull, aliases, favourites) ──────────────────
  "admin.ollama.purpose.fast": { de: "Schnell", en: "Fast" },
  "admin.ollama.purpose.thorough": { de: "Gründlich", en: "Thorough" },
  "admin.ollama.purpose.vision": { de: "Versteht Bilder", en: "Understands images" },
  "admin.ollama.purpose.code": { de: "Programmieren", en: "Coding" },
  "admin.ollama.purpose.translate": { de: "Übersetzen", en: "Translation" },
  "admin.ollama.starting": { de: "Starte…", en: "Starting…" },
  "admin.ollama.done": { de: "Fertig ✓", en: "Done ✓" },
  "admin.ollama.cancelled": { de: "Abgebrochen", en: "Cancelled" },
  "admin.ollama.noProvider": {
    de: "Kein Ollama-Anbieter konfiguriert. Trage oben unter „Anbieter & Endpunkte\" einen Ollama-Anbieter ein, um Modelle zu verwalten.",
    en: "No Ollama provider configured. Add one above under “Providers & endpoints” to manage models.",
  },
  "admin.ollama.server": { de: "Ollama-Server", en: "Ollama server" },
  "admin.ollama.pullTitle": { de: "Modelle laden", en: "Download models" },
  "admin.ollama.pullHint": {
    de: "Modellname aus der Ollama-Bibliothek eingeben (z. B.",
    en: "Enter a model name from the Ollama library (e.g.",
  },
  "admin.ollama.pullTarget": { de: "Lädt auf {url}.", en: "Downloads to {url}." },
  "admin.ollama.pullPlaceholder": { de: "z. B. phi3", en: "e.g. phi3" },
  "admin.ollama.pull": { de: "Laden", en: "Download" },
  "admin.ollama.aliasTitle": { de: "Anzeigenamen & Favoriten", en: "Display names & favourites" },
  "admin.ollama.aliasHint": {
    de: "Der Anzeigename ersetzt die Modell-ID überall in der App. Nutzer ohne technischen Hintergrund können mit „gemma4:e4b\" nichts anfangen — ein Name nach Zweck schon.",
    en: "The display name replaces the model ID everywhere in the app. Non-technical users can't make sense of “gemma4:e4b” — a name that says what it's for, they can.",
  },
  "admin.ollama.noModels": { de: "Keine Modelle gefunden.", en: "No models found." },
  "admin.ollama.unfavorite": { de: "Favorit entfernen", en: "Remove from favourites" },
  "admin.ollama.favorite": { de: "Favorisieren", en: "Add to favourites" },
  "admin.ollama.aliasPlaceholder": { de: "Anzeigename (Alias)…", en: "Display name (alias)…" },

  // ── shared (from fork C; dedupe on merge) ─────────────────────────────
  "common.discard": { de: "Verwerfen", en: "Discard" },
  "common.export": { de: "Exportieren", en: "Export" },
  "common.import": { de: "Importieren", en: "Import" },
  "common.unsaved": { de: "Nicht gespeicherte Änderungen", en: "Unsaved changes" },
  "common.chooseFile": { de: "Datei wählen", en: "Choose file" },
  "common.secretStored": { de: "•••••••• (gespeichert)", en: "•••••••• (stored)" },

  // ── admin: branding ───────────────────────────────────────────────────
  "admin.branding.logoDark": { de: "Logo (dunkler Hintergrund)", en: "Logo (dark background)" },
  "admin.branding.logoDarkHint": {
    de: "PNG mit Transparenz oder SVG. Ersetzt den Namen in der Seitenleiste.",
    en: "PNG with transparency or SVG. Replaces the name in the sidebar.",
  },
  "admin.branding.logoLight": { de: "Logo (heller Hintergrund)", en: "Logo (light background)" },
  "admin.branding.logoLightHint": {
    de: "Optional — nur nötig, wenn das Hauptlogo im hellen Design untergeht.",
    en: "Optional — only needed if the main logo gets lost in light mode.",
  },
  "admin.branding.favicon": { de: "Favicon", en: "Favicon" },
  "admin.branding.faviconHint": {
    de: "Optional — ohne Angabe wird das Logo bzw. ein Icon in Akzentfarbe genutzt.",
    en: "Optional — if empty, the logo or an icon in the accent colour is used.",
  },
  "admin.branding.errLoad": {
    de: "Konfiguration konnte nicht geladen werden.",
    en: "Couldn't load the configuration. Reload the page to try again.",
  },
  "admin.branding.errAdminOnly": { de: "Nur Administratoren.", en: "Administrators only." },
  "admin.branding.errSave": {
    de: "Speichern fehlgeschlagen.",
    en: "Couldn't save. Check your connection and try again.",
  },
  "admin.branding.errImage": {
    de: "Bild konnte nicht gelesen werden.",
    en: "Couldn't read the image. Try a PNG, JPEG, WebP or SVG file.",
  },
  "admin.branding.errNoLogo": { de: "Erst ein Logo hochladen.", en: "Upload a logo first." },
  "admin.branding.errNoColor": {
    de: "Im Logo keine eindeutige Farbe gefunden.",
    en: "No distinct colour found in the logo. Pick the accent colour manually.",
  },
  "admin.branding.errImport": {
    de: "Datei ist keine gültige Marken-JSON.",
    en: "This file isn't a valid brand JSON. Choose a file exported from this panel.",
  },
  "admin.branding.loading": { de: "Marke wird geladen…", en: "Loading brand…" },
  "admin.branding.preview": { de: "Vorschau", en: "Preview" },
  "admin.branding.previewHint": {
    de: "So sieht die Marke aus, sobald du speicherst. Vorher sieht sie niemand sonst.",
    en: "This is how the brand will look once you save. Nobody else sees it before then.",
  },
  "admin.branding.browserTab": { de: "{name} — Browser-Tab", en: "{name} — browser tab" },
  "admin.branding.name": { de: "Name", en: "Name" },
  "admin.branding.nameHint": {
    de: "Erscheint in Seitenleiste, Anmeldeseite, Browser-Tab, E-Mails und in der Authenticator-App.",
    en: "Shown in the sidebar, sign-in page, browser tab, emails and the authenticator app.",
  },
  "admin.branding.appName": { de: "Instanz-/Firmenname", en: "Instance / company name" },
  "admin.branding.tagline": { de: "Unterzeile (optional)", en: "Tagline (optional)" },
  "admin.branding.taglinePh": { de: "KI-Assistent der Musterfirma", en: "AI assistant of Example Corp" },
  "admin.branding.assets": { de: "Logo & Favicon", en: "Logo & favicon" },
  "admin.branding.assetsHint": {
    de: "Datei hochladen (PNG/SVG/WebP) oder eine URL eintragen. Uploads werden verkleinert und in der Instanz-Konfiguration gespeichert.",
    en: "Upload a file (PNG/SVG/WebP) or enter a URL. Uploads are downscaled and stored in the instance configuration.",
  },
  "admin.branding.empty": { de: "leer", en: "empty" },
  "admin.branding.uploadedFile": { de: "hochgeladene Datei", en: "uploaded file" },
  "admin.branding.accent": { de: "Akzentfarbe", en: "Accent colour" },
  "admin.branding.accentHint": {
    de: "Wird für Buttons, Links und Hervorhebungen verwendet.",
    en: "Used for buttons, links and highlights.",
  },
  "admin.branding.pickAccent": { de: "Akzentfarbe wählen", en: "Choose accent colour" },
  "admin.branding.deriveAccent": { de: "Aus Logo ableiten", en: "Derive from logo" },
  "admin.branding.resetAccent": { de: "Zurücksetzen (Indigo)", en: "Reset (indigo)" },
  "admin.branding.legal": { de: "Rechtliches & Support", en: "Legal & support" },
  "admin.branding.legalHint": {
    de: "Wird unter der Anmeldemaske, im Info-Tab und unter dem Chat verlinkt. Leere Felder erscheinen nicht.",
    en: "Linked below the sign-in form, in the About tab and below the chat. Empty fields are hidden.",
  },
  "admin.branding.imprint": { de: "Impressum (URL)", en: "Imprint (URL)" },
  "admin.branding.privacy": { de: "Datenschutz (URL)", en: "Privacy policy (URL)" },
  "admin.branding.supportEmail": { de: "Support-E-Mail", en: "Support email" },
  "admin.branding.supportUrl": { de: "Support-Portal (URL)", en: "Support portal (URL)" },
  "admin.branding.supportUrlInfo": {
    de: "Wenn gesetzt, verweist der Support-Link hierauf statt auf die E-Mail-Adresse.",
    en: "If set, the support link points here instead of the email address.",
  },
  "admin.branding.publicUrl": { de: "Öffentliche Adresse", en: "Public address" },
  "admin.branding.publicUrlHint": {
    de: "Basis für absolute Links in E-Mails und SSO-Rücksprüngen.",
    en: "Base for absolute links in emails and SSO redirects.",
  },
  "admin.branding.appUrl": { de: "Öffentliche App-URL (HTTPS)", en: "Public app URL (HTTPS)" },
  "admin.branding.appUrlInfo": {
    de: "Die von außen erreichbare Adresse dieser Instanz, z. B. https://chat.firma.de. Wird für absolute Links in E-Mails (z. B. Passwort-Reset) verwendet. Ohne diese Angabe rät die App die Adresse aus der Anfrage — hinter einem Reverse-Proxy / bei Bind auf 0.0.0.0 ergibt das eine unbrauchbare URL.",
    en: "The externally reachable address of this instance, e.g. https://chat.example.com. Used for absolute links in emails (e.g. password reset). Without it the app guesses the address from the request — behind a reverse proxy or when bound to 0.0.0.0 that yields an unusable URL.",
  },
  "admin.branding.transfer": { de: "Übertragen", en: "Transfer" },
  "admin.branding.transferHint": {
    de: "Marke als Datei sichern und auf einer anderen Instanz einlesen. Import landet im Entwurf — gespeichert wird erst unten.",
    en: "Back up the brand as a file and load it on another instance. Imports go into the draft — nothing is saved until you click Save below.",
  },
  "admin.branding.resetDefault": { de: "Auf Standard zurücksetzen", en: "Reset to default" },

  // ── admin: single sign-on ─────────────────────────────────────────────
  "admin.sso.title": { de: "Single Sign-On", en: "Single sign-on" },
  "admin.sso.titleInfo": {
    de: "Single Sign-On: Nutzer melden sich mit ihrem Microsoft-Geschäftskonto an (Entra ID) oder über einen anderen OIDC-Server wie ADFS/Keycloak — statt mit einem lokalen Passwort.",
    en: "Single sign-on: users sign in with their Microsoft work account (Entra ID) or through another OIDC server such as ADFS/Keycloak — instead of a local password.",
  },
  "admin.sso.intro": {
    de: "Anmeldung über Microsoft Entra ID oder einen AD/OIDC-Server konfigurieren.",
    en: "Configure sign-in through Microsoft Entra ID or an AD/OIDC server.",
  },
  "admin.sso.envActive": {
    de: "Aktuell aktiv über Umgebungsvariablen. Speichern hier überschreibt das.",
    en: "Currently active via environment variables. Saving here overrides them.",
  },
  "admin.sso.enable": { de: "SSO aktivieren", en: "Enable SSO" },
  "admin.sso.enableInfo": {
    de: "Muss aktiv sein, damit der Anmelde-Button erscheint. Zusätzlich muss die Anmeldeart SSO unter „Registrierung & Zugang“ erlaubt sein.",
    en: "Must be on for the sign-in button to appear. SSO must also be allowed as a sign-in method under “Registration & access”.",
  },
  "admin.sso.provider": { de: "Anbieter", en: "Provider" },
  "admin.sso.providerInfo": {
    de: "Entra ID leitet die Endpunkte automatisch aus der Tenant-ID ab. AD / Generisches OIDC (z. B. ADFS, Keycloak) benötigt die Endpunkt-URLs manuell.",
    en: "Entra ID derives the endpoints from the tenant ID automatically. AD / generic OIDC (e.g. ADFS, Keycloak) needs the endpoint URLs entered manually.",
  },
  "admin.sso.providerAd": { de: "Active Directory / Generisches OIDC", en: "Active Directory / generic OIDC" },
  "admin.sso.redirect": { de: "Redirect-URI (beim Anbieter eintragen)", en: "Redirect URI (register with the provider)" },
  "admin.sso.redirectInfo": {
    de: "Diese Rücksprung-Adresse musst du in der App-Registrierung des Anbieters als „Redirect URI“ hinterlegen, sonst weist er die Anmeldung ab. Sie leitet sich aus der öffentlichen App-URL (Branding-Einstellungen) ab — setze diese auf deine HTTPS-Adresse, damit hier keine http-/0.0.0.0-URL erscheint.",
    en: "Register this address as a “Redirect URI” in the provider's app registration, otherwise it rejects the sign-in. It is derived from the public app URL (brand settings) — set that to your HTTPS address so no http/0.0.0.0 URL appears here.",
  },
  "admin.sso.clientId": { de: "Client-ID", en: "Client ID" },
  "admin.sso.clientIdInfo": {
    de: "Die Anwendungs-(Client-)ID aus der App-Registrierung beim Identity-Provider.",
    en: "The application (client) ID from the app registration at the identity provider.",
  },
  "admin.sso.secret": { de: "Client-Secret", en: "Client secret" },
  "admin.sso.secretInfo": {
    de: "Das Client-Geheimnis aus der App-Registrierung. Verschlüsselt gespeichert, nie zurückgegeben. Leer lassen = gespeichertes behalten.",
    en: "The client secret from the app registration. Stored encrypted, never returned. Leave empty to keep the stored one.",
  },
  "admin.sso.tenant": { de: "Tenant-ID", en: "Tenant ID" },
  "admin.sso.tenantInfo": {
    de: "Die Verzeichnis-(Tenant-)ID deiner Entra-Organisation. Legt die Endpunkte fest UND beschränkt die Anmeldung auf diese Organisation.",
    en: "The directory (tenant) ID of your Entra organisation. Sets the endpoints AND restricts sign-in to this organisation.",
  },
  "admin.sso.tenantPh": {
    de: "tenant-id (z. B. contoso.onmicrosoft.com oder GUID)",
    en: "tenant-id (e.g. contoso.onmicrosoft.com or GUID)",
  },
  "admin.sso.authorizeUrl": { de: "Authorize-URL", en: "Authorize URL" },
  "admin.sso.authorizeUrlInfo": {
    de: "OIDC-Authorization-Endpoint des Servers, z. B. https://adfs.firma.de/adfs/oauth2/authorize.",
    en: "The server's OIDC authorization endpoint, e.g. https://adfs.example.com/adfs/oauth2/authorize.",
  },
  "admin.sso.tokenUrl": { de: "Token-URL", en: "Token URL" },
  "admin.sso.tokenUrlInfo": {
    de: "OIDC-Token-Endpoint des Servers, z. B. https://adfs.firma.de/adfs/oauth2/token.",
    en: "The server's OIDC token endpoint, e.g. https://adfs.example.com/adfs/oauth2/token.",
  },
  "admin.sso.buttonLabel": { de: "Beschriftung des Anmelde-Buttons", en: "Sign-in button label" },
  "admin.sso.buttonLabelInfo": {
    de: "Text auf der Schaltfläche auf der Anmeldeseite. Leer lassen für „Mit Microsoft-Geschäftskonto anmelden“ — bei einem anderen Anbieter (ADFS, Keycloak) hier passend umbenennen.",
    en: "Text on the button on the sign-in page. Leave empty for “Sign in with your Microsoft work account” — rename it to match another provider (ADFS, Keycloak).",
  },

  // ── admin: outgoing email (SMTP) ──────────────────────────────────────
  "admin.smtp.okTest": { de: "Verbindung erfolgreich.", en: "Connection successful." },
  "admin.smtp.errTest": {
    de: "Verbindung fehlgeschlagen.",
    en: "Connection failed. Check host, port and credentials and try again.",
  },
  "admin.smtp.title": { de: "E-Mail-Versand", en: "Outgoing email" },
  "admin.smtp.titleInfo": {
    de: "Postausgangsserver, über den die App E-Mails verschickt — aktuell für „Passwort vergessen“-Links. Ohne konfiguriertes SMTP ist der Self-Service-Reset inaktiv.",
    en: "Outgoing mail server the app sends email through — currently for “Forgot password” links. Without SMTP configured, self-service reset is disabled.",
  },
  "admin.smtp.intro": {
    de: "Nötig, damit Nutzer ihr Passwort per E-Mail-Link selbst zurücksetzen können.",
    en: "Required so users can reset their own password via an email link.",
  },
  "admin.smtp.enable": { de: "E-Mail-Versand aktivieren", en: "Enable outgoing email" },
  "admin.smtp.host": { de: "Host", en: "Host" },
  "admin.smtp.hostInfo": {
    de: "Adresse des Postausgangsservers, z. B. smtp.firma.de oder smtp.office365.com.",
    en: "Address of the outgoing mail server, e.g. smtp.example.com or smtp.office365.com.",
  },
  "admin.smtp.port": { de: "Port", en: "Port" },
  "admin.smtp.portInfo": {
    de: "465 für implizite TLS-Verschlüsselung, 587 für STARTTLS (üblich), 25 unverschlüsselt.",
    en: "465 for implicit TLS, 587 for STARTTLS (common), 25 unencrypted.",
  },
  "admin.smtp.tls": { de: "Implizites TLS", en: "Implicit TLS" },
  "admin.smtp.tlsInfo": {
    de: "An = direkte TLS-Verbindung (Port 465). Aus = STARTTLS (Port 587/25). Im Zweifel: 587 + aus.",
    en: "On = direct TLS connection (port 465). Off = STARTTLS (port 587/25). If unsure: 587 + off.",
  },
  "admin.smtp.user": { de: "Benutzer", en: "User" },
  "admin.smtp.userInfo": {
    de: "Login-Name beim Mailserver — meist die vollständige E-Mail-Adresse des Absenderkontos.",
    en: "Login name at the mail server — usually the full email address of the sending account.",
  },
  "admin.smtp.passwordInfo": {
    de: "Passwort des Absenderkontos. Wird verschlüsselt gespeichert und nie zurückgegeben. Leer lassen = gespeichertes Passwort behalten.",
    en: "Password of the sending account. Stored encrypted and never returned. Leave empty to keep the stored password.",
  },
  "admin.smtp.from": { de: "Absender (From)", en: "Sender (From)" },
  "admin.smtp.fromInfo": {
    de: "Die im Postfach angezeigte Absenderadresse. Eine reine Adresse (noreply@firma.de) bekommt automatisch „{app}“ als Anzeigenamen; ein eigener Anzeigename wird übernommen. Leer = SMTP-Benutzer.",
    en: "The sender address shown in the inbox. A bare address (noreply@example.com) automatically gets “{app}” as display name; a custom display name is kept. Empty = SMTP user.",
  },
  "admin.smtp.linkNote": {
    de: "Der Link in der Reset-Mail nutzt die öffentliche App-URL aus den Branding-Einstellungen. Ist dort nichts gesetzt, rät die App die Adresse aus der Anfrage (hinter Proxy / bei Bind auf 0.0.0.0 evtl. unbrauchbar).",
    en: "The link in the reset email uses the public app URL from the brand settings. If none is set, the app guesses the address from the request (may be unusable behind a proxy or when bound to 0.0.0.0).",
  },
  "admin.smtp.saveTest": { de: "Speichern & testen", en: "Save & test" },

  // ── shared (fork D) ───────────────────────────────────────────────────
  "common.saved": { de: "Gespeichert", en: "Saved" },
  "common.testConnection": { de: "Verbindung testen", en: "Test connection" },
  "common.apiKey": { de: "API-Key", en: "API key" },

  // ── admin: providers ──────────────────────────────────────────────────
  "admin.providers.title": { de: "Anbieter & Endpunkte", en: "Providers & endpoints" },
  "admin.providers.desc": {
    de: "Ollama (lokal) oder OpenAI-kompatible/Anthropic-APIs. Global, serverseitig gespeichert (Keys verlassen den Server nicht).",
    en: "Ollama (local) or OpenAI-compatible/Anthropic APIs. Global and stored on the server (keys never leave it).",
  },
  "admin.providers.addTitle": { de: "Anbieter aus Vorlage hinzufügen", en: "Add a provider from a template" },
  "admin.providers.add": { de: "+ Anbieter hinzufügen…", en: "+ Add provider…" },
  "admin.providers.displayName": { de: "Anzeigename", en: "Display name" },
  "admin.providers.openaiCompat": { de: "OpenAI-kompatibel", en: "OpenAI-compatible" },
  "admin.providers.remove": { de: "Provider entfernen", en: "Remove provider" },
  "admin.providers.baseUrl": { de: "Base-URL", en: "Base URL" },
  "admin.providers.apiKeyPlaceholder": { de: "sk-… / API-Key des Anbieters", en: "sk-… / provider API key" },
  "admin.providers.manualModels": {
    de: "Modelle manuell (optional, Komma-getrennt)",
    en: "Manual models (optional, comma-separated)",
  },
  "admin.providers.manualModelsPlaceholder": { de: "z. B. gpt-4o, claude-sonnet-4-5", en: "e.g. gpt-4o, claude-sonnet-4-5" },
  "admin.providers.testing": { de: "teste…", en: "testing…" },
  "admin.providers.modelCount": { de: "{n} Modelle", en: "{n} models" },
  "admin.providers.save": { de: "Anbieter speichern", en: "Save providers" },

  // ── admin: default models ─────────────────────────────────────────────
  "admin.defaultModels.title": { de: "Standardmodelle", en: "Default models" },
  "admin.defaultModels.desc": {
    de: "Weise jeder Aufgabe ein konkretes Modell zu. Im „Auto\"-Modus prüft der Chat, was gebraucht wird, und lädt genau das hier festgelegte Modell. Ohne Zuweisung greift das Standard-Chat-Modell.",
    en: "Assign a specific model to each task. In “Auto” mode the chat works out what's needed and loads exactly the model set here. Without an assignment, the standard chat model is used.",
  },
  "admin.defaultModels.reloadTitle": { de: "Modell-Liste neu laden", en: "Reload model list" },
  "admin.defaultModels.reload": { de: "Aktualisieren", en: "Refresh" },
  "admin.defaultModels.none": {
    de: "Keine Modelle gefunden. Prüfe oben unter „Anbieter & Endpunkte\", ob ein Anbieter erreichbar ist.",
    en: "No models found. Check under “Providers & endpoints” above that a provider is reachable.",
  },
  "admin.defaultModels.default": { de: "— Standard —", en: "— Default —" },
  "admin.defaultModels.role.standard": { de: "Standard-Chat", en: "Standard chat" },
  "admin.defaultModels.role.standardHint": {
    de: "Allrounder für normale Anfragen (auch Antwort-Stufe der OCR-Kette).",
    en: "All-rounder for everyday requests (also the answer step of the OCR chain).",
  },
  "admin.defaultModels.role.coding": { de: "Coding-Modell", en: "Coding model" },
  "admin.defaultModels.role.codingHint": { de: "Code, Skripte, Debugging.", en: "Code, scripts, debugging." },
  "admin.defaultModels.role.reasoning": { de: "Reasoning / Mathematik", en: "Reasoning / maths" },
  "admin.defaultModels.role.reasoningHint": {
    de: "Logik, Rechnen, mehrstufige Herleitungen.",
    en: "Logic, calculations, multi-step derivations.",
  },
  "admin.defaultModels.role.vision": { de: "OCR-Modell", en: "OCR model" },
  "admin.defaultModels.role.visionHint": {
    de: "Liest Bilder & Scans (Stufe 1 der OCR-Kette).",
    en: "Reads images & scans (step 1 of the OCR chain).",
  },
  "admin.defaultModels.role.title": { de: "Thread-Benennung", en: "Thread naming" },
  "admin.defaultModels.role.titleHint": { de: "Automatischer Chat-Titel.", en: "Automatic chat title." },
  "admin.defaultModels.role.search": { de: "Suchbegriff-Konstruktion", en: "Search query building" },
  "admin.defaultModels.role.searchHint": { de: "Baut die Query für die Web-Suche.", en: "Builds the query for web search." },

  // ── admin: image generation ───────────────────────────────────────────
  "admin.imagegen.desc": {
    de: "Backend für „generiere ein Bild …\". Key bleibt serverseitig.",
    en: "Backend for “generate an image …”. The key stays on the server.",
  },
  "admin.imagegen.enable": { de: "Bildgenerierung aktivieren", en: "Enable image generation" },
  "admin.imagegen.openaiCompat": {
    de: "OpenAI-kompatibel (/images/generations)",
    en: "OpenAI-compatible (/images/generations)",
  },
  "admin.imagegen.comfyui": { de: "ComfyUI (noch nicht unterstützt)", en: "ComfyUI (not supported yet)" },
  "admin.imagegen.size": { de: "Bildgröße", en: "Image size" },
  "admin.imagegen.emptyIsOpenai": { de: "(leer = OpenAI)", en: "(empty = OpenAI)" },
  "admin.imagegen.model": { de: "Modell", en: "Model" },

  // ── settings: web search providers ────────────────────────────────────
  "settings.websearch.providers": { de: "Suchanbieter", en: "Search providers" },
  "settings.websearch.providersDesc": {
    de: "API-Keys werden serverseitig gespeichert. Verwendet wird der erste aktivierte Anbieter mit Key.",
    en: "API keys are stored on the server. The first enabled provider with a key is used.",
  },
  "settings.websearch.active": { de: "Aktiv:", en: "Active:" },
  "settings.websearch.endpointPlaceholder": {
    de: "Endpoint-URL (optional, überschreibt Standard)",
    en: "Endpoint URL (optional, overrides the default)",
  },
  "settings.websearch.hint.tavily": { de: "LLM-optimiert · Key tvly-…", en: "LLM-optimised · key tvly-…" },
  "settings.websearch.hint.bing": { de: "Azure Ocp-Apim-Subscription-Key", en: "Azure Ocp-Apim-Subscription-Key" },
  "settings.websearch.hint.bocha": { de: "Bearer-Key", en: "Bearer key" },
  "settings.websearch.hint.qureit": { de: "Bearer-Key (Best-Effort-Anbindung)", en: "Bearer key (best-effort integration)" },

  // ── admin: plugins / services ─────────────────────────────────────────
  "admin.plugins.title": { de: "Dienste", en: "Services" },
  "admin.plugins.desc": {
    de: "Globale Ein/Aus-Schalter für serverseitige Hintergrund-Dienste. Wirkt für alle Nutzer.",
    en: "Global on/off switches for server-side background services. Applies to all users.",
  },
  "admin.plugins.errLoad": {
    de: "Konnte Dienste nicht laden.",
    en: "Couldn't load services. Reload the page to try again.",
  },
  "admin.plugins.errToggle": {
    de: "Fehler",
    en: "Couldn't change the service. Try again.",
  },
  "admin.plugins.on": { de: "Aktiv", en: "On" },
  "admin.plugins.off": { de: "Deaktiviert", en: "Off" },
  "admin.plugins.officeParser": { de: "Office-Datei-Parser (Word/Excel/CSV)", en: "Office file parser (Word/Excel/CSV)" },
  "admin.plugins.officeParserDesc": {
    de: "Liest .docx/.xlsx/.pptx/.csv beim Upload serverseitig aus.",
    en: "Extracts .docx/.xlsx/.pptx/.csv on the server when uploaded.",
  },
  "admin.plugins.ocrEngine": { de: "Erweiterte OCR-Engine (Bilder/PDFs)", en: "Advanced OCR engine (images/PDFs)" },
  "admin.plugins.ocrEngineDesc": {
    de: "Auto-Modus zieht Text aus Bildern/Dokumenten.",
    en: "Auto mode pulls text out of images/documents.",
  },
  "admin.plugins.docGenerator": {
    de: "Dokumenten-Generator (PDF/Excel-Export)",
    en: "Document generator (PDF/Excel export)",
  },
  "admin.plugins.docGeneratorDesc": {
    de: "Erkennt Erstell-Befehle im Chat und generiert echte Dateien.",
    en: "Detects create commands in chat and generates real files.",
  },
  "admin.plugins.bs.title": { de: "BookStack-Wiki (Integration)", en: "BookStack wiki (integration)" },
  "admin.plugins.bs.desc": {
    de: "Verbindet die KI über die BookStack-REST-API. Sie kann dann autonom das Wiki durchsuchen, lesen und — bei erlaubtem Schreibzugriff — Seiten anlegen, ändern und löschen. Der API-Token wird verschlüsselt gespeichert.",
    en: "Connects the AI through the BookStack REST API. It can then search and read the wiki on its own and — if write access is allowed — create, edit and delete pages. The API token is stored encrypted.",
  },
  "admin.plugins.bs.errLoad": {
    de: "Konnte BookStack-Einstellungen nicht laden.",
    en: "Couldn't load the BookStack settings. Reload the page to try again.",
  },
  "admin.plugins.bs.errSave": {
    de: "Speichern fehlgeschlagen.",
    en: "Couldn't save. Check your entries and try again.",
  },
  "admin.plugins.bs.enable": { de: "Integration aktivieren", en: "Enable integration" },
  "admin.plugins.bs.enableDesc": {
    de: "Stellt der KI die BookStack-Werkzeuge im Chat bereit.",
    en: "Gives the AI the BookStack tools in chat.",
  },
  "admin.plugins.bs.write": { de: "Schreibzugriff erlauben", en: "Allow write access" },
  "admin.plugins.bs.writeDesc": {
    de: "Ohne diese Option stehen nur Lese-/Such-Werkzeuge zur Verfügung — die KI kann keine Seiten erstellen, ändern oder löschen.",
    en: "Without this, only read/search tools are available — the AI can't create, edit or delete pages.",
  },
  "admin.plugins.bs.insecure": { de: "TLS-Zertifikat ignorieren", en: "Ignore TLS certificate" },
  "admin.plugins.bs.insecureDesc1": {
    de: "Nur für Homelabs: erlaubt selbst-signierte Zertifikate bzw.",
    en: "Homelabs only: allows self-signed certificates and",
  },
  "admin.plugins.bs.insecureDesc2": {
    de: "-Domains. Gilt ausschließlich für BookStack-Anfragen.",
    en: " domains. Applies to BookStack requests only.",
  },
  "admin.plugins.bs.url": { de: "BookStack-URL", en: "BookStack URL" },
  "admin.plugins.bs.tokenIdPlaceholder": { de: "z. B. 3xL9…", en: "e.g. 3xL9…" },
  "admin.plugins.bs.secretSaved": { de: "(gespeichert)", en: "(saved)" },
  "admin.plugins.bs.secretKeep": { de: "•••••••• (leer = beibehalten)", en: "•••••••• (empty = keep)" },
  "admin.plugins.bs.save": { de: "BookStack speichern", en: "Save BookStack" },
  "admin.plugins.bs.testTitle": {
    de: "Sendet GET /api/books an die BookStack-Instanz",
    en: "Sends GET /api/books to the BookStack instance",
  },
  "admin.plugins.bs.testOkOne": {
    de: "Verbindung erfolgreich! {n} Buch gefunden.",
    en: "Connection successful! {n} book found.",
  },
  "admin.plugins.bs.testOkMany": {
    de: "Verbindung erfolgreich! {n} Bücher gefunden.",
    en: "Connection successful! {n} books found.",
  },

  // ── knowledge base ────────────────────────────────────────────────────
  "kb.title": { de: "Kategorien & Dokumente", en: "Categories & documents" },
  "kb.desc": {
    de: "Eigene Kategorien + Dokumente (PDF, TXT, DOCX, MD, CSV, PPTX, XLSX). Bei aktivierter Nutzung durchsucht der Chat vorab die Datenbank und belegt Antworten mit Quellen.",
    en: "Your own categories + documents (PDF, TXT, DOCX, MD, CSV, PPTX, XLSX). When enabled, the chat searches the database first and backs answers with sources.",
  },
  "kb.useInChat": { de: "Wissensdatenbank im Chat verwenden", en: "Use knowledge base in chat" },
  "kb.embModel": { de: "Embedding-Modell (Ollama, global)", en: "Embedding model (Ollama, global)" },
  "kb.nouns": { de: "Eigennamen-Wörterbuch (Fuzzy-Suche)", en: "Proper-noun dictionary (fuzzy search)" },
  "kb.nounsDesc": {
    de: "Firmen- und Personen-Eigennamen (einer pro Zeile). Tippfehler in der Suche werden per Levenshtein-Distanz automatisch auf den korrekten Namen korrigiert — z. B. „Msuter GmbH“ → „Muster GmbH“.",
    en: "Company and person names (one per line). Typos in searches are corrected to the right name automatically using Levenshtein distance — e.g. “Msuter GmbH” → “Muster GmbH”.",
  },
  "kb.nounsSaved": { de: "Gespeichert ✓", en: "Saved ✓" },
  "kb.nounsSave": { de: "Wörterbuch speichern", en: "Save dictionary" },
  "kb.newCategory": { de: "Neue Kategorie…", en: "New category…" },
  "kb.category": { de: "Kategorie", en: "Category" },
  "kb.emptyManage": {
    de: "Noch keine Kategorien. Lege eine an, um Dokumente hochzuladen.",
    en: "No categories yet. Create one to upload documents.",
  },
  "kb.emptyRead": {
    de: "Dir wurden noch keine Wissenskategorien freigeschaltet.",
    en: "No knowledge categories have been shared with you yet.",
  },
  "kb.file": { de: "Datei", en: "File" },
  "kb.deleteCategory": { de: "Kategorie löschen", en: "Delete category" },
  "kb.deleteDocument": { de: "Dokument löschen", en: "Delete document" },
  "kb.removeDocument": { de: "Dokument entfernen", en: "Remove document" },
  "kb.chunks": { de: "{n} Abschnitte", en: "{n} sections" },
  "kb.errNoText": {
    de: "Kein Text aus „{name}\" extrahiert.",
    en: "No text could be extracted from “{name}”. Check the file isn't empty or a scanned image, then try again.",
  },
  "kb.errIndex": {
    de: "Indexierung von „{name}\" fehlgeschlagen.",
    en: "Indexing “{name}” failed. Try uploading it again.",
  },
  "kb.confirmCategoryPre": { de: "„{name}\" und ", en: "Permanently delete “{name}” and " },
  "kb.confirmCategoryBold": { de: "alle enthaltenen Dokumente", en: "all documents in it" },
  "kb.confirmCategoryPost": {
    de: " endgültig aus der Wissensdatenbank löschen? Das kann nicht rückgängig gemacht werden.",
    en: " from the knowledge base? This can't be undone.",
  },
  "kb.confirmDocument": {
    de: "„{name}\" endgültig aus der Wissensdatenbank löschen? Das kann nicht rückgängig gemacht werden.",
    en: "Permanently delete “{name}” from the knowledge base? This can't be undone.",
  },

  // ── settings tabs ─────────────────────────────────────────────────────
  "settings.done": { de: "Fertig", en: "Done" },
  "settings.appearance.theme": { de: "Design", en: "Theme" },
  "settings.appearance.themeHint": { de: "Farbschema der gesamten Oberfläche.", en: "Colour scheme for the whole interface." },
  "settings.appearance.light": { de: "Hell", en: "Light" },
  "settings.appearance.dark": { de: "Dunkel", en: "Dark" },
  "settings.appearance.language": { de: "Sprache", en: "Language" },
  "settings.appearance.languageHint": { de: "Sprache der Bedienoberfläche.", en: "Language of the interface." },
  "settings.chat.layout": { de: "Layout", en: "Layout" },
  "settings.chat.layoutHint": { de: "Grundform des Chatverlaufs.", en: "Basic look of the chat view." },
  "settings.chat.classic": { de: "Klassisch", en: "Classic" },
  "settings.chat.classicHint": { de: "Flaches Design", en: "Flat design" },
  "settings.chat.bubble": { de: "Bubble-Layout", en: "Bubbles" },
  "settings.chat.bubbleHint": { de: "Sprechblasen (KI links, du rechts)", en: "Speech bubbles (AI left, you right)" },
  "settings.chat.display": { de: "Anzeige", en: "Display" },
  "settings.chat.displayHint": { de: "Was neben jeder Nachricht eingeblendet wird.", en: "What appears next to each message." },
  "settings.chat.showAvatar": { de: "Avatar neben Nachrichten", en: "Avatar next to messages" },
  "settings.chat.showTimestamps": { de: "Zeitstempel anzeigen", en: "Show timestamps" },
  "settings.chat.showStats": { de: "Statistiken (Wörter & ~Tokens)", en: "Statistics (words & ~tokens)" },
  "settings.chat.images": { de: "Bilder", en: "Images" },
  "settings.chat.imagesHint": {
    de: "Profilbild des Assistenten und Hintergrund des Verlaufs.",
    en: "The assistant's profile picture and the chat background.",
  },
  "settings.chat.assistantAvatar": { de: "Assistenten-Profilbild", en: "Assistant profile picture" },
  "settings.chat.avatarAlt": { de: "Avatar", en: "Avatar" },
  "settings.chat.pickImage": { de: "Bild wählen", en: "Choose image" },
  "settings.chat.removeAvatar": { de: "Assistenten-Avatar entfernen", en: "Remove assistant avatar" },
  "settings.chat.background": { de: "Chathintergrund", en: "Chat background" },
  "settings.chat.backgroundAlt": { de: "Hintergrund", en: "Background" },
  "settings.chat.removeBackground": { de: "Chat-Hintergrund entfernen", en: "Remove chat background" },
  "settings.chat.codePanel": { de: "Code-Panel", en: "Code panel" },
  "settings.chat.codePanelHint": {
    de: "Lange Codeblöcke öffnen sich automatisch in einem Panel rechts.",
    en: "Long code blocks open automatically in a panel on the right.",
  },
  "settings.chat.codePanelOn": { de: "Aktiviert", en: "Enabled" },
  "settings.chat.codeFrom": { de: "Ab", en: "From" },
  "settings.chat.codeLines": { de: "Zeilen", en: "lines" },
  "settings.assistant.instructions": { de: "Anweisungen", en: "Instructions" },
  "settings.assistant.instructionsHint": {
    de: "Dauerhafte Rolle/Regeln für das Modell — wird jeder Unterhaltung als System-Prompt vorangestellt.",
    en: "A lasting role or rules for the model — added to every conversation as the system prompt.",
  },
  "settings.assistant.instructionsPh": {
    de: "z. B. Antworte immer auf Deutsch und fasse dich kurz.",
    en: "e.g. Always answer in English and keep it short.",
  },
  "settings.assistant.templates": { de: "Vorlagen", en: "Templates" },
  "settings.assistant.templatesHint": {
    de: "Prompt-Bibliothek — im Chat per „/\" aufrufbar.",
    en: "Prompt library — open it in chat with “/”.",
  },
  "settings.assistant.newTemplate": { de: "Neue Vorlage", en: "New template" },
  "settings.assistant.add": { de: "Hinzufügen", en: "Add" },
  "settings.assistant.templateTitle": { de: "Titel", en: "Title" },
  "settings.assistant.templateShortcut": { de: "/kürzel", en: "/shortcut" },
  "settings.assistant.removeTemplate": { de: "Vorlage entfernen", en: "Remove template" },
  "settings.assistant.templateText": { de: "Prompt-Text…", en: "Prompt text…" },
  "settings.websearch.hint": {
    de: "Erlaubt dem Modell, für aktuelle Fragen das Web zu durchsuchen. Die Suchanfrage formuliert das Modell „Suchbegriff-Konstruktion\" (siehe Modelle → Standardmodelle); die Treffer werden dem Antwortmodell als Kontext übergeben.",
    en: "Lets the model search the web for current questions. The query is written by the “search query” model (see Models → Default models); the results are passed to the answering model as context.",
  },
  "settings.websearch.enable": { de: "Websuche aktivieren", en: "Turn on web search" },
  "settings.websearch.configure": { de: "Suchanbieter konfigurieren →", en: "Configure search providers →" },
  "settings.data.clearAll": { de: "Alle Chats löschen", en: "Delete all chats" },
  "settings.data.clearAllHint": {
    de: "Entfernt alle Unterhaltungen dieses Kontos. Nicht umkehrbar.",
    en: "Removes every conversation in this account. This can't be undone.",
  },
  "settings.data.clearConfirmTitle": { de: "Alle Chats löschen?", en: "Delete all chats?" },
  "settings.data.clearConfirmBody": {
    de: "Sämtliche Unterhaltungen dieses Kontos werden entfernt — mit allen Prompts, Antworten und angehängten Dateien. Das lässt sich nicht rückgängig machen.",
    en: "Every conversation in this account will be removed — with all prompts, responses and attached files. This can't be undone.",
  },
  "settings.data.clearConfirm": { de: "Alle löschen", en: "Delete all" },
  "settings.perf.title": { de: "VRAM-Verwaltung", en: "VRAM management" },
  "settings.perf.hint": {
    de: "Steuert, wie schnell Ollama Modelle aus dem VRAM entlädt (GPU im Multi-User-Betrieb teilen). Alleinnutzung? Einfach aus lassen.",
    en: "Controls how quickly Ollama unloads models from VRAM (to share the GPU between users). Only one user? Just leave it off.",
  },
  "settings.perf.enable": { de: "VRAM-Management aktiv", en: "VRAM management on" },
  "settings.perf.keepAlive": { de: "Modell entladen nach (keep_alive)", en: "Unload model after (keep_alive)" },
  "settings.perf.values": { de: "Werte:", en: "Values:" },
  "settings.perf.now": { de: "(sofort)", en: "(immediately)" },
  "settings.perf.forever": { de: "(dauerhaft)", en: "(never)" },
  "settings.perf.permanent": { de: "Dauerhaft (RAM-Cache)", en: "Keep loaded (RAM cache)" },
  "settings.perf.note": {
    de: "Aus = Ollama-Default (Modell bleibt geladen). Max. Tokens (num_predict) pro Chat über die Parameter. Server-seitig optional:",
    en: "Off = Ollama default (the model stays loaded). Set max tokens (num_predict) per chat in the parameters. Optional on the server:",
  },

  // ── memory / sidekicks / about / archive ──────────────────────────────
  "memory.title": { de: "Gedächtnis", en: "Memory" },
  "memory.hint": {
    de: "Dauerhafte Fakten über dich. Werden bei jedem Chat unsichtbar als Hintergrundwissen an das Modell gehängt. Automatisch aus deinen Nachrichten extrahiert — hier editier- und löschbar.",
    en: "Lasting facts about you. They're quietly given to the model as background in every chat. Extracted automatically from your messages — edit or delete them here.",
  },
  "memory.enable": { de: "Gedächtnis aktiv (Extraktion + Nutzung)", en: "Memory on (extract + use)" },
  "memory.addPh": {
    de: "Fakt hinzufügen, z. B. Arbeitet in der Marketing-Abteilung",
    en: "Add a fact, e.g. Works in the marketing department",
  },
  "memory.add": { de: "Fakt hinzufügen", en: "Add fact" },
  "memory.empty": { de: "Noch keine Einträge.", en: "No entries yet." },
  "memory.entry": { de: "Gedächtnis-Eintrag", en: "Memory entry" },
  "memory.deleteEntry": { de: "Eintrag löschen", en: "Delete entry" },
  "memory.clearAll": { de: "Alles löschen", en: "Delete all" },
  "memory.clearTitle": { de: "Gesamtes Gedächtnis löschen?", en: "Delete all memory?" },
  "memory.clearBody": { de: "Alle gespeicherten Fakten werden entfernt.", en: "All saved facts will be removed." },
  "sidekicks.newName": { de: "Neuer Sidekick", en: "New sidekick" },
  "sidekicks.hint": {
    de: "Spezialisierte Profile mit eigenem Modell + System-Prompt. Erscheinen in der Sidebar unter „Meine Sidekicks\". Max. {max}.",
    en: "Specialised profiles with their own model + system prompt. They appear in the sidebar under “My sidekicks”. Max. {max}.",
  },
  "sidekicks.max": { de: "Maximal {max} Sidekicks", en: "Up to {max} sidekicks" },
  "sidekicks.empty": { de: "Noch keine Sidekicks.", en: "No sidekicks yet." },
  "sidekicks.namePh": { de: "Name (z. B. IT-Recht-Anwalt)", en: "Name (e.g. IT law expert)" },
  "sidekicks.currentModel": { de: "Aktuelles Modell", en: "Current model" },
  "sidekicks.promptPh": {
    de: "System-Prompt, z. B. Du bist ein erfahrener IT-Recht-Anwalt und antwortest präzise auf Deutsch…",
    en: "System prompt, e.g. You are an experienced IT lawyer and answer precisely in English…",
  },
  "sidekicks.pickIcon": { de: "Symbol wählen", en: "Choose icon" },
  "about.whatsNew": { de: "Was gibt’s Neues?", en: "What's new?" },
  "about.whatsNewHint": { de: "Die neuesten Funktionen und Verbesserungen.", en: "The latest features and improvements." },
  "about.current": { de: "aktuell", en: "current" },
  "archive.empty": { de: "Noch keine Dateien in diesem Chat.", en: "No files in this chat yet." },
  "archive.jump": { de: "Zur Nachricht springen", en: "Jump to message" },

  // ── shared (fork F) ───────────────────────────────────────────────────
  "common.copied": { de: "Kopiert", en: "Copied" },
  "common.reset": { de: "Zurücksetzen", en: "Reset" },
  "common.you": { de: "Du", en: "You" },

  // ── answer style popover ──────────────────────────────────────────────
  "params.title": { de: "Antwortstil", en: "Response style" },
  "params.reset": { de: "Reset", en: "Reset" },
  "params.precise": { de: "Präzise", en: "Precise" },
  "params.balanced": { de: "Ausgewogen", en: "Balanced" },
  "params.creative": { de: "Kreativ", en: "Creative" },
  "params.short": { de: "Kurz", en: "Short" },
  "params.normal": { de: "Normal", en: "Normal" },
  "params.long": { de: "Ausführlich", en: "Detailed" },
  "params.customStyle": { de: "Eigene Einstellung", en: "Custom setting" },
  "params.length": { de: "Länge", en: "Length" },
  "params.customLength": { de: "Eigene Länge", en: "Custom length" },
  "params.advanced": { de: "Erweitert", en: "Advanced" },
  "params.temperature": { de: "Temperatur", en: "Temperature" },
  "params.temperatureHint": { de: "Kreativität", en: "Creativity" },
  "params.temperatureInfo": {
    de: "Steuert die Zufälligkeit der Antworten. Niedrig (0–0.3) = fokussiert und vorhersehbar, hoch (0.8–2) = kreativer, aber sprunghafter.",
    en: "Controls how random responses are. Low (0–0.3) = focused and predictable, high (0.8–2) = more creative but less consistent.",
  },
  "params.topPHint": { de: "Nukleus-Sampling", en: "Nucleus sampling" },
  "params.topPInfo": {
    de: "Begrenzt die Wortauswahl auf die wahrscheinlichsten Tokens, deren Wahrscheinlichkeit zusammen P ergibt. 1.0 = alle erlaubt, niedriger = konservativer. Meist nur Temperatur ODER Top_P anpassen.",
    en: "Limits word choice to the most likely tokens whose combined probability adds up to P. 1.0 = all allowed, lower = more conservative. Usually adjust either temperature OR Top_P, not both.",
  },
  "params.maxTokens": { de: "Max Tokens", en: "Max tokens" },
  "params.maxTokensHint": { de: "Antwortlänge", en: "Response length" },
  "params.maxTokensInfo": {
    de: "Obergrenze für die Länge der Antwort in Tokens (~¾ Wort pro Token). Höher erlaubt längere Antworten, kostet aber mehr Rechenzeit.",
    en: "Upper limit for the response length in tokens (~¾ of a word per token). Higher allows longer responses but takes more compute time.",
  },
  "params.explain": { de: "Erklärung anzeigen", en: "Show explanation" },

  // ── workspaces ────────────────────────────────────────────────────────
  "workspace.personal": { de: "Persönlich", en: "Personal" },
  "workspace.label": { de: "Workspace", en: "Workspace" },
  "workspace.manage": { de: "Workspaces verwalten", en: "Manage workspaces" },
  "workspace.noTeam": {
    de: "Noch kein Team-Workspace — lege einen an, um zu teilen.",
    en: "No team workspace yet — create one to share.",
  },
  "workspace.share": { de: "Workspace teilen", en: "Share workspace" },
  "workspace.shareNamed": { de: "Workspace „{name}“ teilen", en: "Share workspace “{name}”" },
  "workspace.deleteHint": {
    de: "Workspace löschen (Inhalte wandern nach „Persönlich“)",
    en: "Delete workspace (its content moves to “Personal”)",
  },
  "workspace.deleteNamed": { de: "Workspace „{name}“ löschen", en: "Delete workspace “{name}”" },
  "workspace.name": { de: "Workspace-Name", en: "Workspace name" },
  "workspace.namePlaceholder": { de: "Workspace-Name…", en: "Workspace name…" },
  "workspace.shareBody": {
    de: "Sende diesen Link an Teammitglieder — wer eingeloggt ist und ihn öffnet, wird Mitglied von „{name}\".",
    en: "Send this link to your teammates — anyone signed in who opens it becomes a member of “{name}”.",
  },

  // ── join workspace page ───────────────────────────────────────────────
  "join.noToken": { de: "Kein Einladungs-Token.", en: "No invite token. Ask for a new invite link." },
  "join.failed": {
    de: "Beitritt fehlgeschlagen.",
    en: "Couldn't join the workspace. Ask for a new invite link and try again.",
  },
  "join.joining": { de: "Trete Workspace bei…", en: "Joining workspace…" },
  "join.joined": { de: "Beigetreten", en: "Joined" },
  "join.joinedBody": {
    de: "Du bist jetzt Mitglied von „{name}\". Weiterleitung…",
    en: "You're now a member of “{name}”. Redirecting…",
  },
  "join.failedTitle": { de: "Fehlgeschlagen", en: "Couldn't join" },

  // ── notes / chat info ─────────────────────────────────────────────────
  "notes.title": { de: "Notizen", en: "Notes" },
  "notes.saved": { de: "gespeichert", en: "saved" },
  "notes.placeholder": {
    de: "Deine Notizen — automatisch gespeichert, chatübergreifend…",
    en: "Your notes — saved automatically, across all chats…",
  },
  "chatInfo.title": { de: "Zu diesem Chat", en: "About this chat" },
  "chatInfo.files": { de: "Dateien", en: "Files" },
  "chatInfo.starred": { de: "Markiert", en: "Starred" },
  "chatInfo.noStarred": {
    de: "Noch nichts markiert. Der Stern unter einer Nachricht sammelt sie hier.",
    en: "Nothing starred yet. The star below a message collects it here.",
  },
  "chatInfo.notesPlaceholder": { de: "Notizen zu diesem Chat…", en: "Notes on this chat…" },

  // ── code blocks / code panel / SVG ────────────────────────────────────
  "code.code": { de: "Code", en: "Code" },
  "code.preview": { de: "Vorschau", en: "Preview" },
  "code.docCreating": { de: "Dokument wird erstellt…", en: "Creating document…" },
  "code.inSplit": { de: "Code im Splitscreen", en: "Code in split view" },
  "code.showInChat": { de: "Im Chat anzeigen", en: "Show in chat" },
  "code.openSplit": { de: "Im Splitscreen öffnen", en: "Open in split view" },
  "code.split": { de: "Splitscreen", en: "Split view" },
  "code.downloadExt": { de: "Herunterladen (.{ext})", en: "Download (.{ext})" },
  "code.downloadShort": { de: "Download", en: "Download" },
  "code.showPreview": { de: "Vorschau anzeigen", en: "Show preview" },
  "code.showSource": { de: "Quellcode anzeigen", en: "Show source" },
  "code.exportSvg": { de: "Als .svg exportieren", en: "Export as .svg" },
  "code.export": { de: "Export", en: "Export" },
  "code.svgPreview": { de: "SVG-Vorschau", en: "SVG preview" },

  // ── brand footer / shared chat page ───────────────────────────────────
  "brand.imprint": { de: "Impressum", en: "Legal notice" },
  "brand.privacy": { de: "Datenschutz", en: "Privacy" },
  "brand.support": { de: "Support", en: "Support" },
  "share.toApp": { de: "Zur App", en: "Go to app" },
  "share.title": { de: "Geteilter Chat", en: "Shared chat" },
  "share.readOnly": { de: "Nur-Lese-Ansicht", en: "Read-only view" },
  "share.invalid": {
    de: "Kein gültiger geteilter Chat in der URL.",
    en: "This link doesn't contain a valid shared chat. Ask the sender for a new link.",
  },
  "share.assistant": { de: "Assistant", en: "Assistant" },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
type Vars = Record<string, string | number>;
export type TFn = (key: StringKey, vars?: Vars) => string;

/** Translate outside React. Unknown {placeholders} are left as-is. */
export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const e: Entry = STRINGS[key];
  const s = e[lang] ?? e.de;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/**
 * Translate with the current UI language (de before auto-detect, and during
 * hydration — zustand serves the initial state then, so SSR text matches).
 * The returned function is stable per language: safe in memo/useCallback deps.
 */
export function useT(): TFn {
  const lang = (useStore((s) => s.lang) ?? "de") as Lang;
  return useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
}

/** A specific, actionable message with the server's own wording kept as detail. */
export function withDetail(main: string, detail?: unknown): string {
  const d = typeof detail === "string" ? detail.trim().replace(/\.$/, "") : "";
  return d ? `${main} (${d})` : main;
}
