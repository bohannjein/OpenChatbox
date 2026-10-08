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
 * Admin-only panels are not translated yet and keep their German literals.
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
    en: "Translate the following text into English:\n\n",
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
