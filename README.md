# OpenChatbox

Self-hosted, ChatGPT-style chat UI for **Ollama** and **OpenAI-compatible**
backends. Streaming answers, Markdown with copy buttons, model switcher,
sidekicks, workspaces, first-run admin setup, and an admin dashboard — all in a
single Next.js app you run yourself.

---

## ⚡ Quick Install (one command)

On any Ubuntu/Linux server with `curl`, run:

```bash
curl -fsSL https://raw.githubusercontent.com/bohannjein/OpenChatbox/main/install.sh | bash
```

That's it. The script clones the repo, installs Docker + Compose if missing,
builds the image, and starts everything **detached on port `6769`**. When it
finishes, open:

```
http://<your-server-ip>:6769
```

The first visit shows the **setup screen** — create your admin account and point
it at your Ollama/OpenAI server. Done.

> Custom port or install dir:
> ```bash
> curl -fsSL https://raw.githubusercontent.com/bohannjein/OpenChatbox/main/install.sh | OPENCHATBOX_PORT=8080 bash
> ```

---

## Features
- **Streaming chat** — Ollama (NDJSON) and OpenAI-compatible (SSE) normalized to
  one delta stream server-side; reasoning/thinking output split out.
- **Attachments** — drag & drop / paste images and documents; parsed via a
  multipart upload endpoint and passed to the model as structured context.
- **Auto-title** — the first answer names the chat via a hidden model call.
- **Sidekicks** — reusable assistant profiles (system prompt + model).
- **Workspaces** — scope chats/sidekicks/files to a collaboration space.
- **Auth + first-run setup** — local accounts, optional Entra/OIDC SSO, 2FA.
- **Admin dashboard** — model pull/aliases, custom roles editor, and a secure
  Ollama web-terminal (HTTP-API mapped, no shell).
- Light/dark, custom accent + logo, per-user history.

## Manual install (Docker)
```bash
git clone https://github.com/bohannjein/OpenChatbox.git && cd OpenChatbox
cp .env.example .env          # set AUTH_SECRET: openssl rand -hex 32
OPENCHATBOX_PORT=6769 docker compose up -d --build
```

## Local development
```bash
npm install
npm run dev                   # http://localhost:3000
npm run build && npm start    # production
```

## Providers
Configured under Settings → Providers:
- **Ollama (local)** — `http://localhost:11434`. In Docker, use
  `http://host.docker.internal:11434` or the bundled `ollama` service.
- **OpenAI-compatible** — `https://api.openai.com/v1` (or HF TGI / vLLM / …).
  Enter base URL + API key.

## Data & configuration
- Runtime state (admin account, server config) lives in `data/` — gitignored,
  never in the image. In Docker it's the `openchatbox-data` volume.
- Override its location with `OPENCHATBOX_DATA_DIR`.
- Required env: `AUTH_SECRET`. Optional SSO env: see `.env.example`.

## Architecture
```
app/
  layout.tsx              # theme no-flash script, metadata
  api/chat/route.ts       # streaming proxy: Ollama/OpenAI/Anthropic → delta stream
  api/upload/route.ts     # multipart file upload → clean JSON attachments
  api/setup/route.ts      # first-run admin bootstrap
  api/admin/terminal      # admin-only Ollama web-terminal (streaming)
  api/admin/roles         # custom roles CRUD
  api/workspaces          # workspace membership
components/               # Sidebar, ChatWindow, ChatInput, AdminPanel,
                          # AdminTerminal, RolesEditor, WorkspaceSwitcher, …
lib/
  store.ts                # Zustand store (persist, per-user namespace)
  providers.ts            # fetchModels, streamChat, generateTitle
  server/                 # users, sessions, roles, workspaces, config (file-backed)
```

### Why a proxy?
The browser talks to `/api/chat`, not directly to Ollama/OpenAI — this avoids
CORS issues (especially with local Ollama) and normalizes the different provider
stream formats server-side. API keys are passed per request to your own proxy.

## License
See repository.
