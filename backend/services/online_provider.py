import os
import time

import requests
import yt_dlp
import random
import threading
from backend.services.cookie_manager import cookie_manager


# ── Caching ─────────────────────────────────────────────────────────────────
_STREAM_CACHE = {}
_STREAM_CACHE_MAX = 500
_STREAM_CACHE_TTL = int(os.getenv("STREAM_CACHE_TTL_SECONDS", "7200"))

# ── Curated Piped Instances (high-uptime, known-working) ────────────────────
# These are used as a fallback when Piped registry fetch fails.
# Verified workable on cloud deployments as of July 2026.
_CURATED_PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.smnz.de",
    "https://api.piped.privacydev.net",
    "https://pipedapi.unisocial.net",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.astartes.nl",
    "https://pipedapi.lunar.icu",
    "https://pipedapi.pfcd.me",
    "https://pipedapi.frontendfriendly.xyz",
    "https://pipedapi.r4fo.com",
]
_PIPED_INSTANCES_CACHE = None
_PIPED_INSTANCES_CACHE_TIME = 0
_PIPED_INSTANCES_HEALTHY = set()  # Track which instances have worked recently

# ── Proxy Config ────────────────────────────────────────────────────────────
# Support Cloudflare WARP or rotating proxies for bypassing datacenter IP blocks.
# Set STREAM_PROXY to a SOCKS5/HTTP proxy URL (e.g., socks5://127.0.0.1:40000 for WARP)
_STREAM_PROXY = os.getenv("STREAM_PROXY", "")

# Thread-local proxy selector for round-robin across multiple proxies
_proxy_list = []
_proxy_lock = threading.Lock()

def _init_proxies():
    global _proxy_list
    if not _STREAM_PROXY:
        _proxy_list = []
        return
    # Support multiple proxies: "socks5://proxy1:1080,socks5://proxy2:1080"
    _proxy_list = [p.strip() for p in _STREAM_PROXY.split(",") if p.strip()]

_init_proxies()

def _get_random_proxy():
    """Pick a random proxy from the configured list."""
    if not _proxy_list:
        return None
    return random.choice(_proxy_list) if len(_proxy_list) > 1 else _proxy_list[0]


# ── Status ───────────────────────────────────────────────────────────────────
def get_online_provider_status():
    mode = os.getenv("ONLINE_STREAM_PROVIDER", "extractor").strip().lower()
    resolver_url = _resolver_url()
    return {
        "mode": mode,
        "enabled": mode != "disabled",
        "resolver_configured": bool(resolver_url),
        "resolver_url": resolver_url if resolver_url else None,
        "proxy_configured": bool(_STREAM_PROXY),
        "piped_instances_available": len(_PIPED_INSTANCES_HEALTHY) > 0 if _PIPED_INSTANCES_HEALTHY else bool(_PIPED_INSTANCES_CACHE or _CURATED_PIPED_INSTANCES),
    }


def _cache_get(video_id):
    entry = _STREAM_CACHE.get(video_id)
    if not entry:
        return None, None
    url, fmt, expiry = entry
    if time.time() < expiry:
        return url, fmt
    _STREAM_CACHE.pop(video_id, None)
    return None, None


def _cache_set(video_id, url, fmt):
    if not url:
        return
    if len(_STREAM_CACHE) >= _STREAM_CACHE_MAX:
        oldest_key = min(_STREAM_CACHE, key=lambda k: _STREAM_CACHE[k][2])
        del _STREAM_CACHE[oldest_key]
    _STREAM_CACHE[video_id] = (url, fmt, time.time() + _STREAM_CACHE_TTL)


# ── Resolver (Node.js youtubei.js microservice) ────────────────────────────
def _resolve_with_resolver(video_id):
    resolver_url = _resolver_url()
    if not resolver_url:
        return None, None

    headers = {}
    resolver_key = os.getenv("RESOLVER_API_KEY", "").strip()
    if resolver_key:
        headers["x-resolver-key"] = resolver_key

    resp = requests.get(
        f"{resolver_url}/resolve/{video_id}",
        headers=headers,
        timeout=int(os.getenv("RESOLVER_TIMEOUT_SECONDS", "12")),
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("url"), data.get("mimeType") or data.get("format") or data.get("client")


def _resolver_url():
    explicit_url = os.getenv("RESOLVER_URL", "").strip().rstrip("/")
    if explicit_url:
        return explicit_url
    hostport = os.getenv("RESOLVER_HOSTPORT", "").strip()
    if hostport:
        return f"http://{hostport}".rstrip("/")
    return ""


# ── Piped Instances (open-source YouTube proxy) ─────────────────────────────
def _fetch_piped_instances():
    """Fetch the dynamic list of Piped instances from the registry."""
    try:
        resp = requests.get("https://piped-instances.kavin.rocks/", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return [inst.get('api_url') for inst in data if inst.get('api_url')]
    except Exception as e:
        print(f"[Piped] Failed to fetch instances: {e}")
        return None


def _get_piped_instances():
    """Get list of Piped instances to try. Uses curated list + dynamic fetch."""
    global _PIPED_INSTANCES_CACHE, _PIPED_INSTANCES_CACHE_TIME

    # Start with healthy instances we've verified recently (most reliable)
    result = list(_PIPED_INSTANCES_HEALTHY) if _PIPED_INSTANCES_HEALTHY else []

    # Add curated instances (known-working high-uptime ones)
    for inst in _CURATED_PIPED_INSTANCES:
        if inst not in result:
            result.append(inst)

    # Add env-var custom instances
    custom_instances = os.getenv("YT_PIPED_INSTANCES")
    if custom_instances:
        for inst in custom_instances.split(','):
            inst = inst.strip()
            if inst and inst not in result:
                result.append(inst)

    # Try to fetch fresh instances (only if cache is > 1 hour old)
    now = time.time()
    if not _PIPED_INSTANCES_CACHE or (now - _PIPED_INSTANCES_CACHE_TIME > 3600):
        dynamic = _fetch_piped_instances()
        if dynamic:
            _PIPED_INSTANCES_CACHE = dynamic
            _PIPED_INSTANCES_CACHE_TIME = now
            for inst in dynamic:
                if inst not in result:
                    result.append(inst)

    # Shuffle for load distribution, but keep healthy instances at the front
    healthy_count = len(_PIPED_INSTANCES_HEALTHY)
    healthy = result[:healthy_count]
    rest = result[healthy_count:]
    random.shuffle(rest)
    result = healthy + rest

    return result


def _resolve_with_piped(video_id):
    instances = _get_piped_instances()
    last_error = None

    for base_url in instances:
        try:
            resp = requests.get(f"{base_url}/streams/{video_id}", timeout=10)
            if resp.status_code != 200:
                continue

            data = resp.json()
            audio_streams = data.get("audioStreams", [])
            if audio_streams:
                best = sorted(audio_streams, key=lambda x: x.get("bitrate", 0), reverse=True)[0]
                stream_url = best.get("url")
                if stream_url:
                    # Mark this instance as healthy
                    _PIPED_INSTANCES_HEALTHY.add(base_url)
                    print(f"[Piped] SUCCESS via {base_url}: {best.get('bitrate', 0)}bps")
                    return stream_url, "m4a (piped)"
        except Exception as e:
            last_error = e
            continue

    if last_error:
        print(f"[Piped] All instances failed for {video_id}. Last error: {last_error}")
    return None, None


# ── yt-dlp (direct extraction) ───────────────────────────────────────────────
def _resolve_with_ytdlp(video_id):
    url = f"https://music.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extract_flat": False,
        "socket_timeout": 10,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://music.youtube.com/",
        },
    }

    # Inject proxy if configured (e.g., Cloudflare WARP sidecar on localhost:40000)
    proxy = _get_random_proxy()
    if proxy:
        ydl_opts["proxy"] = proxy
        print(f"[yt-dlp] Using proxy: {proxy}")

    # Inject cookies if available
    cookie_path = cookie_manager.get_cookie_file_path()
    if cookie_path:
        ydl_opts["cookiefile"] = cookie_path
        cookie_manager.is_cookie_stale()

    # Retry loop with exponential backoff
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                audio_url = info.get("url")
                if audio_url:
                    return audio_url, info.get("format", "audio")
        except Exception as e:
            err_str = str(e).lower()
            if "sign in" in err_str or "bot" in err_str or "429" in err_str:
                # YouTube is actively blocking us — try next method immediately
                print(f"[yt-dlp] YouTube blocking detected: {e}")
                return None, None
            if attempt < max_attempts - 1:
                sleep_time = 2 * (2 ** attempt)
                print(f"[yt-dlp] Retry {attempt + 1}/{max_attempts} after {sleep_time}s: {e}")
                time.sleep(sleep_time)
            else:
                raise e

    return None, None


# ── Main Resolution ──────────────────────────────────────────────────────────
def get_audio_stream_url(video_id):
    cached_url, cached_fmt = _cache_get(video_id)
    if cached_url:
        return cached_url, cached_fmt

    mode = os.getenv("ONLINE_STREAM_PROVIDER", "extractor").strip().lower()
    if mode == "disabled":
        return None, None

    attempts = []
    if mode == "resolver":
        attempts.extend([("resolver", _resolve_with_resolver)])
    elif mode == "piped":
        attempts.extend([("piped", _resolve_with_piped)])
    elif mode == "auto":
        attempts.extend([
            ("resolver", _resolve_with_resolver),
            ("piped", _resolve_with_piped),
            ("yt-dlp", _resolve_with_ytdlp),
        ])
    else:
        # extractor mode (default) — try all methods in parallel-resilient order
        attempts.extend([
            ("resolver", _resolve_with_resolver),
            ("piped", _resolve_with_piped),
            ("yt-dlp", _resolve_with_ytdlp),
        ])

    for name, resolver in attempts:
        try:
            audio_url, fmt = resolver(video_id)
            if audio_url:
                resolved_fmt = fmt or name
                _cache_set(video_id, audio_url, resolved_fmt)
                return audio_url, resolved_fmt
        except Exception as exc:
            print(f"[Stream] {name} resolution failed for {video_id}: {exc}")

    return None, None
