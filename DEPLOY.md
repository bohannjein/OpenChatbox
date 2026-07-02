# OpenChatbox — Deployment

## 1. Push to GitHub
Pushes to `https://github.com/bohannjein/OpenChatbox.git`. Build artefacts,
`/data` (your admin account) and `.env` stay local via `.gitignore`.

```bash
bash scripts/github-push.sh
```
> Uses HTTPS — GitHub will prompt for a Personal Access Token as the password
> if you're not already authenticated (`gh auth login` also works).

## 2. Build & push the Docker image (Docker Hub)
```bash
bash scripts/docker-push.sh                       # bohannjein/openchatbox:latest
IMAGE=you/openchatbox TAG=v1.0 bash scripts/docker-push.sh
```

## 3. Run
```bash
cp .env.example .env
# set AUTH_SECRET:  openssl rand -hex 32
docker compose up -d --build
```
Open http://localhost:3000 → first launch shows the **setup screen** to create
the admin account and server data.

### Notes
- **Persistence:** admin/config live in the `openchatbox-data` volume (`/app/data`),
  never in git (gitignored) or the image. Override the location with
  `OPENCHATBOX_DATA_DIR` (e.g. a host path like `/var/lib/openchatbox`).
- **Ollama on the host:** set the provider Base URL to
  `http://host.docker.internal:11434` (the compose file maps that host).
  Or uncomment the `ollama` service and use `http://ollama:11434`.
- **Env:** `AUTH_SECRET` is required; SSO vars are optional (see `.env.example`).
