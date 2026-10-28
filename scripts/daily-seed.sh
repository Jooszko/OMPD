#!/bin/sh
cd /opt/bakery || exit 1
export COMPOSE_FILE=docker-compose.yml:docker-compose.server.yml

echo "=== $(date) ==="
docker compose exec -T backend python manage.py seed_today_deliveries
docker compose exec -T backend python manage.py recalculate_min_stock
