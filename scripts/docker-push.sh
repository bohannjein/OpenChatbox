#!/usr/bin/env bash
# Build the OpenChatbox image and push it to Docker Hub.
#
#   bash scripts/docker-push.sh                 # -> bohannjein/openchatbox:latest
#   IMAGE=you/openchatbox TAG=v1.0 bash scripts/docker-push.sh
set -euo pipefail

IMAGE="${IMAGE:-bohannjein/openchatbox}"
TAG="${TAG:-latest}"

cd "$(dirname "$0")/.."

# Additionally tag with the short git SHA when available (immutable reference).
SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"

echo "→ building ${IMAGE}:${TAG}"
docker build -t "${IMAGE}:${TAG}" .
if [ -n "$SHA" ]; then
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:${SHA}"
fi

# Login is a no-op if already authenticated (uses ~/.docker/config.json).
echo "→ docker login (Docker Hub)"
docker login

echo "→ pushing ${IMAGE}:${TAG}"
docker push "${IMAGE}:${TAG}"
if [ -n "$SHA" ]; then
  echo "→ pushing ${IMAGE}:${SHA}"
  docker push "${IMAGE}:${SHA}"
fi

echo "✓ pushed ${IMAGE}:${TAG}${SHA:+ and ${IMAGE}:${SHA}}"
