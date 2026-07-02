#!/usr/bin/env bash
#
# OpenChatbox 1-click installer.
#   curl -fsSL https://raw.githubusercontent.com/bohannjein/OpenChatbox/main/install.sh | bash
#
# Clones the repo, ensures Docker + Compose, then builds & starts the stack
# in detached mode, mapped to external port 6769.
set -euo pipefail

REPO_URL="https://github.com/bohannjein/OpenChatbox.git"
APP_DIR="${OPENCHATBOX_DIR:-$HOME/OpenChatbox}"
PORT="${OPENCHATBOX_PORT:-6769}"

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Run a command as root when not already root.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else
    die "Bitte als root ausführen oder 'sudo' installieren."
  fi
fi

need_apt() { command -v apt-get >/dev/null 2>&1; }

install_pkg() {
  # $@ = apt package names
  if need_apt; then
    $SUDO apt-get update -y
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y "$@"
  else
    die "Kein apt-get gefunden. Bitte $* manuell installieren (nicht-Debian-System)."
  fi
}

# ── git ───────────────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  log "git nicht gefunden — installiere…"
  install_pkg git
fi
ok "git vorhanden"

# ── Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Docker nicht gefunden — installiere via get.docker.com…"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker 2>/dev/null || true
fi
docker --version >/dev/null 2>&1 || die "Docker-Installation fehlgeschlagen."
ok "Docker vorhanden"

# ── Docker Compose (plugin 'docker compose' oder Legacy 'docker-compose') ────
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  log "Docker-Compose nicht gefunden — installiere Plugin…"
  install_pkg docker-compose-plugin || true
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  else
    die "Docker Compose konnte nicht installiert werden."
  fi
fi
ok "Compose: $COMPOSE"

# docker ohne sudo? sonst allen docker-Aufrufen SUDO voranstellen
DOCKER_SUDO=""
if ! docker info >/dev/null 2>&1; then
  DOCKER_SUDO="$SUDO"
fi

# ── Repo klonen / aktualisieren ──────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "Repo existiert — aktualisiere ($APP_DIR)…"
  git -C "$APP_DIR" pull --ff-only || warn "git pull übersprungen"
else
  log "Klone Repo nach $APP_DIR…"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
ok "Quellcode bereit"

# ── .env (AUTH_SECRET + Port) ────────────────────────────────────────────────
if [ ! -f .env ]; then
  log "Erzeuge .env…"
  SECRET="$(openssl rand -hex 32 2>/dev/null || head -c32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  {
    echo "AUTH_SECRET=$SECRET"
    echo "OPENCHATBOX_PORT=$PORT"
    echo "NODE_ENV=production"
  } > .env
  ok ".env erstellt (AUTH_SECRET generiert)"
else
  # sicherstellen, dass der Port gesetzt ist
  if grep -q '^OPENCHATBOX_PORT=' .env; then
    sed -i "s/^OPENCHATBOX_PORT=.*/OPENCHATBOX_PORT=$PORT/" .env
  else
    echo "OPENCHATBOX_PORT=$PORT" >> .env
  fi
  grep -q '^AUTH_SECRET=' .env || echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
  ok ".env vorhanden (Port auf $PORT gesetzt)"
fi

# ── Build & Start (detached) ─────────────────────────────────────────────────
log "Baue & starte Container (Port $PORT)…"
export OPENCHATBOX_PORT="$PORT"
$DOCKER_SUDO $COMPOSE up -d --build

# ── Zugriffs-URL ─────────────────────────────────────────────────────────────
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "${IP:-}" ] && IP="localhost"
echo
ok "OpenChatbox läuft!"
echo "   → http://$IP:$PORT"
echo "   Ersteinrichtung (Admin-Konto anlegen) im Browser öffnen."
echo "   Logs:  ($DOCKER_SUDO $COMPOSE logs -f)   Stop: ($DOCKER_SUDO $COMPOSE down)"
