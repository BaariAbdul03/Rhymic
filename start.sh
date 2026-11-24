#!/usr/bin/env bash
set -Eeuo pipefail

PUBLIC_PORT="${PORT:-10000}"
RESOLVER_PORT="${RESOLVER_PORT:-3001}"
export ONLINE_STREAM_PROVIDER="${ONLINE_STREAM_PROVIDER:-embed}"
WEB_COMMAND=(gunicorn app:app --bind "0.0.0.0:${PUBLIC_PORT}" --workers "${WEB_CONCURRENCY:-1}" --threads 4 --timeout 120)

case "$ONLINE_STREAM_PROVIDER" in
  embed|disabled|piped) exec "${WEB_COMMAND[@]}" ;;
esac

export RESOLVER_HOSTPORT="127.0.0.1:${RESOLVER_PORT}"

# ── Start WARP Proxy (background process) ──────────────────────────────────
# WARP provides a Cloudflare-routed SOCKS5 proxy to bypass YouTube's
# datacenter IP blocks. Set WARP_ENABLED=true to activate.
# IMPORTANT: We SOURCE start_warp.sh so STREAM_PROXY env var propagates.
if [[ "${WARP_ENABLED:-false}" == "true" ]]; then
  echo ""
  echo "=============================================="
  echo "  Starting WARP SOCKS5 Proxy..."
  echo "=============================================="
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  # shellcheck source=scripts/start_warp.sh
  source "${SCRIPT_DIR}/scripts/start_warp.sh"
  echo "  WARP PID: $(cat /tmp/warp_proxy.pid 2>/dev/null || echo 'N/A')"
  echo "  STREAM_PROXY: ${STREAM_PROXY:-}"
  echo "=============================================="
  echo ""
fi

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
  "${WEB_COMMAND[*]}"
