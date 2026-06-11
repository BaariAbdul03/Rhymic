import os
import time

import requests
import yt_dlp
import random
from backend.services.cookie_manager import cookie_manager


_STREAM_CACHE = {}
_STREAM_CACHE_MAX = 500
_STREAM_CACHE_TTL = int(os.getenv("STREAM_CACHE_TTL_SECONDS", "7200"))

_PIPED_INSTANCES_CACHE = None
_PIPED_INSTANCES_CACHE_TIME = 0


def get_online_provider_status():
    mode = os.getenv("ONLINE_STREAM_PROVIDER", "extractor").strip().lower()
    resolver_url = _resolver_url()
    return {
        "mode": mode,
        "enabled": mode != "disabled",
        "resolver_configured": bool(resolver_url),
        "resolver_url": resolver_url if resolver_url else None,
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


def _resolve_with_piped(video_id):
    global _PIPED_INSTANCES_CACHE, _PIPED_INSTANCES_CACHE_TIME

    # Check for custom instances from env
    custom_instances = os.getenv("YT_PIPED_INSTANCES")
    if custom_instances:
        instances = [url.strip() for url in custom_instances.split(',') if url.strip()]
    else:
        # Fetch dynamic list from Piped registry if cache is empty or older than 1 hour
        now = time.time()
        if not _PIPED_INSTANCES_CACHE or (now - _PIPED_INSTANCES_CACHE_TIME > 3600):
            try:
                resp = requests.get("https://piped-instances.kavin.rocks/", timeout=5)
                resp.raise_for_status()
                data = resp.json()
                _PIPED_INSTANCES_CACHE = [inst.get('api_url') for inst in data if inst.get('api_url')]
                _PIPED_INSTANCES_CACHE_TIME = now
            except Exception as e:
                print(f"[Piped] Failed to fetch instances: {e}")
                if not _PIPED_INSTANCES_CACHE:
                    return None, None
        instances = list(_PIPED_INSTANCES_CACHE)

    # Shuffle to distribute load
    random.shuffle(instances)

    for base_url in instances:
        try:
            resp = requests.get(f"{base_url}/streams/{video_id}", timeout=8)
            if resp.status_code != 200:
                continue

            audio_streams = resp.json().get("audioStreams", [])
            if audio_streams:
                best = sorted(audio_streams, key=lambda x: x.get("bitrate", 0), reverse=True)[0]
                return best.get("url"), "m4a (piped)"
        except Exception:
            continue

    return None, None


def _resolve_with_ytdlp(video_id):
    url = f"https://music.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "mweb"],
                "player_skip": ["webpage"],
                "skip": ["hls", "dash"],
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        "socket_timeout": 10,
    }

    # Inject cookies if available
    cookie_path = cookie_manager.get_cookie_file_path()
    if cookie_path:
        ydl_opts["cookiefile"] = cookie_path
        # Check for staleness periodically
        cookie_manager.is_cookie_stale()

    # Retry loop with backoff
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return info.get("url"), info.get("format")
        except Exception as e:
            if attempt < max_attempts - 1:
                time.sleep(2 * (2 ** attempt))  # 2-second exponential backoff
            else:
                raise e


def get_audio_stream_url(video_id):
    cached_url, cached_fmt = _cache_get(video_id)
    if cached_url:
        return cached_url, cached_fmt

    mode = os.getenv("ONLINE_STREAM_PROVIDER", "extractor").strip().lower()
    if mode == "disabled":
        return None, None

    attempts = []
    if mode in {"resolver", "auto"}:
        attempts.append(("resolver", _resolve_with_resolver))
        if mode == "auto":
            attempts.extend([("yt-dlp", _resolve_with_ytdlp), ("piped", _resolve_with_piped)])
    elif mode == "extractor":
        attempts.extend([("resolver", _resolve_with_resolver), ("yt-dlp", _resolve_with_ytdlp), ("piped", _resolve_with_piped)])
    else:
        print(f"[Stream] Unknown ONLINE_STREAM_PROVIDER={mode!r}; online streaming disabled.")
        return None, None

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
