#!/usr/bin/env bash
# ─── RhyMic WARP Proxy Starter ──────────────────────────────────────────────
# Starts the WARP SOCKS5 proxy for bypassing YouTube IP blocks.
# IMPORTANT: This script should be SOURCED from start.sh, not executed,
# so that the STREAM_PROXY env var propagates to the parent process.
#
# Sourcing: source scripts/start_warp.sh   (or . scripts/start_warp.sh)
# Subprocess: bash scripts/start_warp.sh   (ENV VAR WILL BE LOST!)
#
# Environment variables:
#   WARP_ENABLED      — Set to "true" to enable WARP proxy (default: false)
#   WARP_MODE         — wireproxy (default), warp-cli, or external
#   WARP_PORT         — SOCKS5 port (default: 40000)
#   WARP_EXTERNAL_PROXY — External SOCKS5 URL for 'external' mode
# ────────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

WARP_ENABLED="${WARP_ENABLED:-false}"
WARP_MODE="${WARP_MODE:-wireproxy}"
WARP_PORT="${WARP_PORT:-40000}"
PROXY_ADDR="socks5://127.0.0.1:${WARP_PORT}"

if [[ "${WARP_ENABLED}" != "true" ]]; then
  echo "[start_warp] WARP proxy disabled (set WARP_ENABLED=true to enable)"
  return 0 2>/dev/null || exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║     RhyMic — Starting WARP SOCKS5 Proxy                            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ── Mode: external ──────────────────────────────────────────────────────────
if [[ "${WARP_MODE}" == "external" ]]; then
  if [[ -z "${WARP_EXTERNAL_PROXY:-}" ]]; then
    echo "[start_warp] ERROR: WARP_MODE=external but no WARP_EXTERNAL_PROXY set"
    return 1 2>/dev/null || exit 1
  fi
  export STREAM_PROXY="${WARP_EXTERNAL_PROXY}"
  echo "[start_warp] Using external proxy: ${STREAM_PROXY}"
  echo "[start_warp] No background process needed."
  return 0 2>/dev/null || exit 0
fi

# ── Mode: wireproxy (recommended, no TUN required) ──────────────────────────
if [[ "${WARP_MODE}" == "wireproxy" ]]; then
  echo "[start_warp] Starting wireproxy mode (userspace WARP SOCKS5)..."
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  python3 "${SCRIPT_DIR}/warp_proxy.py" --mode wireproxy --port "${WARP_PORT}" &
  WARP_PID=$!
  export STREAM_PROXY="${PROXY_ADDR}"

  # Wait for proxy to be ready
  echo "[start_warp] Waiting for WARP proxy on port ${WARP_PORT}..."
  for i in $(seq 1 15); do
    if curl -s --socks5 "127.0.0.1:${WARP_PORT}" --max-time 2 https://1.1.1.1/cdn-cgi/trace > /dev/null 2>&1; then
      echo "[start_warp] ✅ WARP proxy ready on ${PROXY_ADDR}"
      break
    fi
    if ! kill -0 "${WARP_PID}" 2>/dev/null; then
      echo "[start_warp] ❌ WARP process died unexpectedly"
      break
    fi
    echo "[start_warp]   Waiting... (${i}/15)"
    sleep 2
  done

  # Save PID for cleanup
  echo "${WARP_PID}" > /tmp/warp_proxy.pid
  echo "[start_warp] WARP proxy PID: ${WARP_PID}"
  echo "[start_warp] STREAM_PROXY=${STREAM_PROXY}"
  return 0 2>/dev/null || exit 0
fi

# ── Mode: warp-cli (needs TUN device, unlikely to work on Render) ───────────
if [[ "${WARP_MODE}" == "warp-cli" ]]; then
  echo "[start_warp] Starting warp-cli mode (requires TUN device)..."
  if ! command -v warp-cli &> /dev/null; then
    echo "[start_warp] ERROR: warp-cli not found. Install cloudflare-warp package."
    return 1 2>/dev/null || exit 1
  fi

  warp-cli set-mode proxy
  warp-cli register || echo "[start_warp] WARP register may need manual auth"
  warp-cli connect
  export STREAM_PROXY="${PROXY_ADDR}"
  echo "[start_warp] WARP connected via warp-cli. Proxy: ${PROXY_ADDR}"
  return 0 2>/dev/null || exit 0
fi

echo "[start_warp] Unknown WARP_MODE: ${WARP_MODE}"
return 1 2>/dev/null || exit 1
