from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required
import re
import os
import yt_dlp
from ytmusicapi import YTMusic
import requests as py_requests

stream_bp = Blueprint('stream', __name__)

# Singleton YTMusic instance (no auth needed for public search)
ytmusic = YTMusic()

def fix_thumbnail(url):
    """
    Returns a direct, high-quality image URL.
    No proxying — Google CDN images load fine directly in <img> tags
    with referrerPolicy="no-referrer" (which SongCover.jsx already uses).
    Proxying through Render's flagged IP was causing 500s and slow loads.
    """
    if not url:
        return ''
    
    # CASE A: Google CDN (lh3.googleusercontent.com, etc.)
    if 'googleusercontent.com' in url or 'ggpht.com' in url:
        if '=' in url:
            base = url.split('=')[0]
            url = f"{base}=s0"
        else:
            url = f"{url}=s0"
            
    # CASE B: YouTube Video CDN (i.ytimg.com)
    if 'i.ytimg.com' in url:
        if 'default.jpg' in url:
            url = url.replace('default.jpg', 'maxresdefault.jpg')
    
    return url

# --- Dynamic Instance Resolution System ---
# Instead of hardcoding stale instance URLs, we fetch the list of healthy
# instances from official registries on startup and refresh periodically.

import time
import threading

_instance_cache = {
    "piped": [],
    "invidious": [],
    "last_refresh": 0,
    "lock": threading.Lock()
}

INSTANCE_REFRESH_INTERVAL = 1800  # 30 minutes

def _refresh_instances():
    """Fetch healthy Piped and Invidious instances from official registries."""
    piped_apis = []
    invidious_apis = []
    
    # Fetch Piped instances
    try:
        resp = py_requests.get("https://piped-instances.kavin.rocks/", timeout=5)
        if resp.status_code == 200:
            for inst in resp.json():
                api_url = inst.get("api_url", "")
                if api_url and inst.get("up_to_date"):
                    piped_apis.append(api_url.rstrip("/"))
            print(f"[Instances] Loaded {len(piped_apis)} Piped instances")
    except Exception as e:
        print(f"[Instances] Failed to fetch Piped list: {e}")
    
    # Fetch Invidious instances
    try:
        resp = py_requests.get("https://api.invidious.io/instances.json?sort_by=health", timeout=5)
        if resp.status_code == 200:
            for item in resp.json():
                name, info = item[0], item[1]
                # Only use HTTPS instances with API enabled
                if (info.get("type") == "https" and 
                    info.get("api") is True and
                    info.get("monitor", {}).get("down") is False):
                    invidious_apis.append(info["uri"].rstrip("/"))
            print(f"[Instances] Loaded {len(invidious_apis)} Invidious instances")
    except Exception as e:
        print(f"[Instances] Failed to fetch Invidious list: {e}")
    
    # Hardcoded fallbacks in case the registries themselves are down
    if not piped_apis:
        piped_apis = ["https://api.piped.private.coffee", "https://pipedapi.kavin.rocks"]
    if not invidious_apis:
        invidious_apis = ["https://inv.nadeko.net", "https://inv.thepixora.com", "https://invidious.nerdvpn.de"]
    
    with _instance_cache["lock"]:
        _instance_cache["piped"] = piped_apis
        _instance_cache["invidious"] = invidious_apis
        _instance_cache["last_refresh"] = time.time()

def _get_instances():
    """Returns cached instance lists, refreshing if stale."""
    if time.time() - _instance_cache["last_refresh"] > INSTANCE_REFRESH_INTERVAL:
        try:
            _refresh_instances()
        except Exception:
            pass  # Use stale cache if refresh fails
    with _instance_cache["lock"]:
        return list(_instance_cache["piped"]), list(_instance_cache["invidious"])

# Initialize instances on module load (in a thread to not block startup)
threading.Thread(target=_refresh_instances, daemon=True).start()

@stream_bp.route('/debug-instances', methods=['GET'])
def debug_instances():
    """Debug endpoint to check health of instance cache."""
    piped, invidious = _get_instances()
    return jsonify({
        "piped_count": len(piped),
        "invidious_count": len(invidious),
        "last_refresh": _instance_cache["last_refresh"],
        "piped_samples": piped[:5],
        "invidious_samples": invidious[:5]
    })

def resolve_piped_fallback(video_id):
    """Resolve stream via dynamically-fetched Piped instances."""
    piped_apis, _ = _get_instances()
    
    # Try more instances (up to 10) to ensure we find a working one
    for base_url in piped_apis[:10]:
        try:
            print(f"[Piped] Trying: {base_url}")
            # Use a slightly longer timeout for slower instances
            resp = py_requests.get(f"{base_url}/streams/{video_id}", timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                audio_streams = data.get('audioStreams', [])
                if audio_streams:
                    # Prefer m4a/mp4 for better browser compatibility
                    best = sorted(audio_streams, key=lambda x: (x.get('mimeType', '').startswith('audio/mp4'), x.get('bitrate', 0)), reverse=True)[0]
                    print(f"[Piped] Success via {base_url}")
                    return best.get('url'), "audio (piped)"
        except Exception as e:
            print(f"[Piped] Failed {base_url}: {e}")
            continue
    return None, None

def resolve_invidious_fallback(video_id):
    """Resolve stream via dynamically-fetched Invidious instances."""
    _, invidious_apis = _get_instances()
    
    # Try more instances (up to 10)
    for base_url in invidious_apis[:10]:
        try:
            print(f"[Invidious] Trying: {base_url}")
            resp = py_requests.get(f"{base_url}/api/v1/videos/{video_id}", timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                adaptive = data.get('adaptiveFormats', [])
                # Filter for audio-only formats
                audio_formats = [f for f in adaptive if f.get('type', '').startswith('audio/')]
                if audio_formats:
                    # Sort by bitrate
                    best = sorted(audio_formats, key=lambda x: int(x.get('bitrate', '0').replace(',', '')), reverse=True)[0]
                    url = best.get('url', '')
                    if url:
                        print(f"[Invidious] Success via {base_url}")
                        return url, "audio (invidious)"
        except Exception as e:
            print(f"[Invidious] Failed {base_url}: {e}")
            continue
    return None, None

def resolve_via_node_service(video_id):
    """
    Tier 0: Call the dedicated Node.js resolver microservice (running internally).
    """
    resolver_url = "http://localhost:3001"
    resolver_key = os.environ.get('RESOLVER_API_KEY', 'rhymic-resolver-key')
    
    try:
        print(f"[NodeResolver] Attempting for {video_id}")
        resp = py_requests.get(
            f"{resolver_url}/resolve/{video_id}",
            headers={'x-resolver-key': resolver_key},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get('url'):
                print(f"[NodeResolver] Success for {video_id}")
                return data['url'], data.get('mimeType', 'audio')
    except Exception as e:
        print(f"[NodeResolver] Error: {e}")
    return None, None

def resolve_via_cobalt(video_id):
    """
    Tier 4: Cobalt API. Very resilient third-party downloader API.
    """
    try:
        print(f"[Cobalt] Attempting for {video_id}")
        payload = {
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "downloadMode": "audio",
            "audioFormat": "mp3",
            "youtubeVideoCodec": "h264",
            "alwaysProxy": True
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        # Known healthy cobalt instances
        for api_url in ["https://api.cobalt.tools", "https://cobalt.api.unext.cc"]:
            try:
                resp = py_requests.post(api_url, json=payload, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "stream" and data.get("url"):
                        print(f"[Cobalt] Success via {api_url}")
                        return data["url"], "audio/mp3"
            except: continue
    except Exception as e:
        print(f"[Cobalt] Error: {e}")
    return None, None

def get_audio_stream_url(video_id):
    """
    Five-Tiered Resolution:
    0. Node.js Resolver (Internal)
    1. yt-dlp (Aggressive Spoofing)
    2. Piped API (Dynamic)
    3. Invidious API (Dynamic)
    4. Cobalt API (External)
    """
    url = f"https://music.youtube.com/watch?v={video_id}"
    
    # Tier 0: Node.js resolver
    stream_url, fmt = resolve_via_node_service(video_id)
    if stream_url: return stream_url, fmt
    
    # Tier 1: yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True, 'no_warnings': True, 'noplaylist': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'android', 'web_embedded'],
                'skip': ['hls', 'dash']
            }
        },
        'socket_timeout': 5
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            stream_url = info.get('url')
            if stream_url:
                print(f"[yt-dlp] Success for {video_id}")
                return stream_url, info.get('format')
    except Exception: pass
    
    # Tier 2: Piped
    stream_url, fmt = resolve_piped_fallback(video_id)
    if stream_url: return stream_url, fmt
    
    # Tier 3: Invidious
    stream_url, fmt = resolve_invidious_fallback(video_id)
    if stream_url: return stream_url, fmt
    
    # Tier 4: Cobalt
    stream_url, fmt = resolve_via_cobalt(video_id)
    if stream_url: return stream_url, fmt
    
    print(f"[Audio] ALL RESOLUTION TIERS FAILED for {video_id}")
    return None, None

@stream_bp.route('/search', methods=['GET'])
@jwt_required()
def search_online():
    query = request.args.get('q')
    if not query: return jsonify({"message": "Query required"}), 400
    try:
        raw = ytmusic.search(query, filter="songs")
        results = []
        for item in raw[:15]:
            artists = ", ".join([a['name'] for a in item.get('artists', [])])
            thumbs = item.get('thumbnails', [])
            cover = fix_thumbnail(thumbs[-1]['url']) if thumbs else ''
            album = item.get('album', {})
            results.append({
                "id": item.get('videoId'),
                "title": item.get('title'),
                "artist": artists,
                "cover": cover,
                "duration": item.get('duration'),
                "album": album.get('name') if album else None,
                "source": "online"
            })
        return jsonify(results), 200
    except Exception as e:
        print(f"[Search Error] {e}")
        return jsonify({"message": "Search failed"}), 500

@stream_bp.route('/audio/<video_id>', methods=['GET'])
@jwt_required()
def get_audio_url(video_id):
    """Resolves a videoId to a direct audio stream URL."""
    try:
        audio_url, fmt = get_audio_stream_url(video_id)
        if not audio_url:
            piped, invidious = _get_instances()
            return jsonify({
                "message": "All resolution tiers failed.",
                "debug": f"Piped:{len(piped)} Inv:{len(invidious)}",
                "suggestion": "Check server logs for bot detection or instance failures."
            }), 404
        return jsonify({"url": audio_url, "format": fmt}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@stream_bp.route('/proxy/<video_id>', methods=['GET'])
def proxy_audio(video_id):
    """
    Direct byte-level proxy. The browser's <audio> element hits this URL.
    """
    try:
        audio_url, _ = get_audio_stream_url(video_id)
        if not audio_url:
            return Response("Not found", status=404)
        
        headers = {}
        range_header = request.headers.get('Range')
        if range_header:
            headers['Range'] = range_header
        
        # Add User-Agent to upstream request
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

        upstream = py_requests.get(audio_url, stream=True, headers=headers, timeout=15)
        
        resp_headers = {
            'Content-Type': upstream.headers.get('Content-Type', 'audio/webm'),
            'Accept-Ranges': 'bytes',
        }
        if upstream.headers.get('Content-Length'):
            resp_headers['Content-Length'] = upstream.headers['Content-Length']
        if upstream.headers.get('Content-Range'):
            resp_headers['Content-Range'] = upstream.headers['Content-Range']
        
        status = 206 if upstream.status_code == 206 else 200
        
        return Response(
            upstream.iter_content(chunk_size=1024 * 64),
            status=status,
            headers=resp_headers
        )
    except Exception as e:
        print(f"[Stream Proxy Error] {e}")
        return Response("Stream error", status=500)

@stream_bp.route('/thumbnail', methods=['GET'])
def proxy_thumbnail():
    """
    Proxies thumbnails to bypass CORS/Referrer blocks.
    """
    from backend.services.cache_service import thumbnail_cache
    from backend.services.storage_service import upload_thumbnail, get_cached_thumbnail_url
    from flask import send_file, redirect
    import mimetypes

    target_url = request.args.get('url')
    fallback_url = request.args.get('fallback')
    
    if not target_url:
        return Response("URL required", status=400)
    
    try:
        file_hash = thumbnail_cache._get_hash(target_url)

        # Tier 1: Local Disk Cache
        try:
            cached_path = thumbnail_cache.get_cached_path(target_url)
            if cached_path:
                mime = mimetypes.guess_type(target_url)[0] or 'image/jpeg'
                return send_file(cached_path, mimetype=mime)
        except Exception: pass

        # Tier 2: Supabase (Persistence)
        cloud_url = get_cached_thumbnail_url(file_hash)
        if cloud_url:
            try:
                head = py_requests.head(cloud_url, timeout=1.5)
                if head.status_code == 200:
                    return redirect(cloud_url)
            except Exception: pass

        # Tier 3: Fetch Upstream
        common_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://music.youtube.com/',
        }

        session = py_requests.Session()
        try:
            resp = session.get(target_url, headers=common_headers, stream=True, timeout=8)
            if resp.status_code != 200 and fallback_url and fallback_url != target_url:
                resp.close()
                resp = session.get(fallback_url, headers=common_headers, stream=True, timeout=8)
            
            if resp.status_code == 200:
                content = resp.content
                mime = resp.headers.get('Content-Type', 'image/jpeg')
                
                # Async-ish save (don't let it block the response if possible, but for now we do it)
                try:
                    thumbnail_cache.save_to_cache(target_url, content)
                    upload_thumbnail(content, file_hash, mime)
                except Exception: pass

                return Response(content, status=200, headers={'Content-Type': mime})
        except Exception as fetch_err:
            print(f"[Thumbnail Proxy Fetch Err] {fetch_err}")

        # Tier 4: FINAL REDIRECT (Bypass Proxy)
        # if proxy fails, just send the client directly to the fallback URL
        # The SongCover component in React will handle the CORS failure if it happens
        if fallback_url:
            return redirect(fallback_url)
        return Response("Proxy failed", status=504)

    except Exception as e:
        print(f"[Thumbnail Proxy Critical Error] {e}")
        if fallback_url: return redirect(fallback_url)
        return Response("Internal Error", status=500)
    
@stream_bp.route('/trending', methods=['GET'])
@jwt_required()
def get_trending():
    """Returns trending songs from YouTube Music charts."""
    try:
        raw = ytmusic.search("trending music 2025", filter="songs")
        
        results = []
        for item in raw[:15]:
            artists = ", ".join([a['name'] for a in item.get('artists', [])])
            thumbs = item.get('thumbnails', [])
            cover = fix_thumbnail(thumbs[-1]['url']) if thumbs else ''
            album = item.get('album', {})
            
            results.append({
                "id": item.get('videoId'),
                "title": item.get('title'),
                "artist": artists,
                "cover": cover,
                "duration": item.get('duration'),
                "album": album.get('name') if album else None,
                "source": "online"
            })
        return jsonify(results), 200
    except Exception as e:
        print(f"[Trending Error] {e}")
        return jsonify([]), 200

@stream_bp.route('/related/<video_id>', methods=['GET'])
@jwt_required()
def get_related(video_id):
    """Returns a radio mix of ~25 songs similar to the given videoId."""
    try:
        watch = ytmusic.get_watch_playlist(video_id)
        tracks = watch.get('tracks', [])
        
        results = []
        for t in tracks[:25]:
            artists = ", ".join([a['name'] for a in t.get('artists', [])])
            # Handle both 'thumbnail' and 'thumbnails' keys
            thumbs = t.get('thumbnail') or t.get('thumbnails') or []
            
            if isinstance(thumbs, list) and thumbs:
                cover = fix_thumbnail(thumbs[-1].get('url', ''))
            elif isinstance(thumbs, dict):
                cover = fix_thumbnail(thumbs.get('url', ''))
            else:
                cover = ''
            
            results.append({
                "id": t.get('videoId'),
                "title": t.get('title'),
                "artist": artists,
                "cover": cover,
                "duration": t.get('length') or t.get('duration'),
                "source": "online"
            })
        return jsonify(results), 200
    except Exception as e:
        print(f"[Related Error] {e}")
        return jsonify([]), 200
