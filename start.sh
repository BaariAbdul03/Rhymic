#!/usr/bin/env bash
set -Eeuo pipefail

PUBLIC_PORT="${PORT:-10000}"
RESOLVER_PORT="${RESOLVER_PORT:-3001}"

export RESOLVER_HOSTPORT="127.0.0.1:${RESOLVER_PORT}"
export ONLINE_STREAM_PROVIDER="${ONLINE_STREAM_PROVIDER:-auto}"

if [[ -z "${RESOLVER_API_KEY:-}" ]]; then
  echo "RESOLVER_API_KEY must be configured."
  exit 1
fi

CONCURRENTLY="./backend/resolver/node_modules/.bin/concurrently"

if [[ ! -x "$CONCURRENTLY" ]]; then
  echo "concurrently is not installed."
  exit 1
fi

exec "$CONCURRENTLY" \
  --kill-others \
  --names "resolver,web" \
  --prefix-colors "cyan,green" \
  "cd backend/resolver && PORT=${RESOLVER_PORT} node server.js" \
  "gunicorn app:app --bind 0.0.0.0:${PUBLIC_PORT} --workers ${WEB_CONCURRENCY:-1} --timeout 120"
