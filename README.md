# Chatbot UI

Selbstgehostete Chat-Oberfläche im ChatGPT-Look. Next.js (App Router) + Tailwind
+ Zustand. Streaming, Markdown mit Code-Kopierbutton, Modell-Switcher, Dark/Light,
einklappbare Sidebar. Verlauf & API-Keys bleiben im **LocalStorage** des Browsers —
keine Datenbank nötig.

## Stack
- **Next.js 16** (App Router, Turbopack) · **React 19**
- **Tailwind CSS** (`darkMode: class`)
- **Zustand** (persist → LocalStorage)
- **lucide-react**, **react-markdown** + **remark-gfm** + **rehype-highlight**

## Start
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # Produktion
```

## Provider
Standardmäßig konfiguriert (Einstellungen → Provider):
- **Ollama (lokal)** — `http://localhost:11434`. Modelle via `/api/tags`.
- **OpenAI-kompatibel** — `https://api.openai.com/v1` (oder HF TGI / vLLM). Base-URL
  + API-Key eintragen. Modelle via `/models`, Chat via `/chat/completions`.

Weitere Provider per „Hinzufügen" ergänzbar. Jeder Provider hat An/Aus-Schalter und
„Verbindung testen".

## Architektur
```
app/
  layout.tsx            # Theme-No-Flash-Script, Metadata
  page.tsx              # App-Shell (Sidebar + Chat + Settings)
  api/chat/route.ts     # Streaming-Proxy: Ollama NDJSON / OpenAI SSE → Text-Deltas
  api/models/route.ts   # Modell-Liste je Provider
components/             # Sidebar, ChatWindow, ChatInput, ChatMessage,
                        # ModelSwitcher, Markdown, CodeBlock, SettingsModal
lib/
  store.ts              # Zustand-Store (persist)
  providers.ts          # fetchModels, streamChat, modelKey-Helfer
  types.ts
```

### Warum ein Proxy?
Der Browser spricht nicht direkt mit Ollama/OpenAI, sondern mit
`/api/chat` bzw. `/api/models`. Das umgeht CORS-Probleme (v. a. bei lokalem Ollama)
und normalisiert die zwei unterschiedlichen Stream-Formate serverseitig zu einem
einheitlichen Text-Delta-Stream. API-Keys liegen im Browser und werden pro Request
an den eigenen Server-Proxy übergeben.

## Bedienung
- **Enter** senden · **Shift+Enter** Zeilenumbruch · Eingabefeld wächst mit.
- Modell-Switcher oben links im Chat.
- Stop-Button (■) bricht die Generierung ab (`AbortController`).
- Sidebar mobil einklappbar; Chats umbenennen/löschen per Hover.
