# OpenChatbox

A self-hosted chat web app for local and remote LLMs. It runs as a single
Next.js service and talks to any [Ollama](https://ollama.com) instance or any
OpenAI-compatible API. You host it yourself; conversations and configuration
stay on your own server.

Ollama is not bundled. You point OpenChatbox at an Ollama or OpenAI-compatible
endpoint you already run.

## What it does

- Streams chat responses from Ollama (NDJSON) and OpenAI-compatible APIs (SSE),
  normalized server-side into one stream. Reasoning/thinking output is shown
  separately when a model emits it.
- Renders Markdown with code blocks, copy buttons, and a split-screen code view.
- Auto-router: each message can be routed automatically to a model configured
  for coding, reasoning, vision, or general use.
- Knowledge base (RAG): upload documents (PDF, TXT, MD, CSV, DOCX, PPTX, XLSX),
  which are chunked and embedded locally; answers cite their sources.
- BookStack wiki integration: searches a BookStack instance and cites pages.
  Search tolerates typos, including a configurable dictionary of company/person
  proper nouns that are corrected before searching.
- Web search through a configurable provider (Bing, Tavily, Bocha, Qureit).
  Off by default in each new chat.
- Document generation: produces PDF or Excel files from a chat answer.
- File uploads as structured context; images and documents are parsed on upload.
- Sidekicks (reusable assistant profiles), workspaces (scoped chats/files), and
  a moderated group/conference mode with multiple assistants.
- Light and dark themes, custom accent color and logo, per-user chat history.
- Accounts with a first-run admin setup, optional Microsoft Entra / OIDC SSO,
  and optional 2FA.
- Admin area: pull/alias models, edit roles, configure providers and plugins,
  and a read-only Ollama web terminal (mapped to the HTTP API, no shell).

## Requirements

- An Ollama server or an OpenAI-compatible API endpoint.
- To run with Docker: Docker and Docker Compose.
- To run from source: Node.js 20+.

## Installation

### Option 1 — one-command installer (Linux, Docker)

On a Debian/Ubuntu server with `curl`:

```bash
curl -fsSL https://raw.githubusercontent.com/bohannjein/OpenChatbox/main/install.sh | bash
```

The script installs Docker and Compose if missing, clones the repository,
generates an `.env` with an `AUTH_SECRET`, then builds and starts the container
detached on port `6769`. Open `http://<server-ip>:6769` and complete the setup
screen (create the admin account, point it at your model backend).

Override the port or install directory:

```bash
curl -fsSL https://raw.githubusercontent.com/bohannjein/OpenChatbox/main/install.sh | OPENCHATBOX_PORT=8080 bash
```

### Option 2 — Docker Compose (manual)

```bash
git clone https://github.com/bohannjein/OpenChatbox.git
cd OpenChatbox
cp .env.example .env
# set AUTH_SECRET in .env:  openssl rand -hex 32
OPENCHATBOX_PORT=6769 docker compose up -d --build
```

The container listens on `3000` internally; `OPENCHATBOX_PORT` sets the external
port. Runtime state (admin account, server config) is stored in the
`openchatbox-data` volume.

### Option 3 — from source (development)

```bash
npm install
npm run dev                 # http://localhost:3000
# or a production build:
npm run build && npm start
```

## Configuration

- `AUTH_SECRET` (required): session signing key. Generate with
  `openssl rand -hex 32`.
- `AUTH_COOKIE_SECURE` (optional): leave empty to auto-detect; set `true` behind
  HTTPS, `false` to force plain-HTTP cookies on a LAN.
- SSO (optional): `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`,
  `OIDC_AUTHORIZE_URL`, `OIDC_TOKEN_URL`. See `.env.example`.
- `OPENCHATBOX_DATA_DIR` (optional): store runtime state on a host path instead
  of the Docker volume.

### Model backends

Configured under Settings → Providers:

- Ollama: local is `http://localhost:11434`. From inside Docker, use
  `http://host.docker.internal:11434` (the Compose file maps that host) or the
  address of your Ollama server.
- OpenAI-compatible: base URL plus API key (OpenAI, vLLM, HF TGI, etc.).

## Updating

- Installer / Compose: `git pull` then
  `docker compose up -d --build`.
- The running version is shown in Settings → "Über OpenChatbox / Info", which
  also lists the changelog. Released versions are tagged and published under
  [Releases](https://github.com/bohannjein/OpenChatbox/releases).

## Data

Runtime state lives in `data/` (Docker volume `openchatbox-data`, mounted at
`/app/data`). It is gitignored and never baked into the image.

## License

See the repository.
