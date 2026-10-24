#!/bin/sh
cd /opt/bakery || exit 1
export COMPOSE_FILE=docker-compose.yml:docker-compose.server.yml

exec 9>/tmp/bakery-update.lock
flock -n 9 || exit 0

git fetch --quiet origin main || exit 1
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0

echo "=== $(date) aktualizacja do $(git rev-parse --short origin/main) ==="
OLD=$(git rev-parse HEAD)
git merge --ff-only origin/main && docker compose up --build -d && docker image prune -f || exit 1
git diff --quiet "$OLD" HEAD -- Caddyfile || docker compose restart caddy