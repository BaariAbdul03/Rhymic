from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required
import re
import yt_dlp
from ytmusicapi import YTMusic
import requests as py_requests
import threading

# Global locks and memory cache to prevent "disappearing" thumbnails due to race conditions
_thumbnail_lock = threading.Lock()
_fetch_locks = {} # Per-hash locks
_memory_cache = {} # Hot cache for this process session

stream_bp = Blueprint('stream', __name__)

# Singleton YTMusic instance (no auth needed for public search)
ytmusic = YTMusic()

def fix_thumbnail(url):
    """
    ULTIMATE PERMANENT FIX:
    1. For Google-hosted images: Force '=s0' for max quality.
    2. For YouTube images: Force 'maxresdefault.jpg' for HD video covers.
    """
    if not url:
        return ''
    
    # CASE A: Google CDN (lh3.googleusercontent.com, etc.)
    if 'googleusercontent.com' in url or 'ggpht.com' in url:
        if '=' in url:
            # Strip existing size params and force s0
            base = url.split('=')[0]
            url = f"{base}=s0"
        else:
            url = f"{url}=s0"
            
    # CASE B: YouTube Video CDN (i.ytimg.com)
    hi_res_url = url
    if 'i.ytimg.com' in url:
        if 'default.jpg' in url:
            # Try to upgrade to maxres or hq
            hi_res_url = url.replace('default.jpg', 'maxresdefault.jpg')
    
    # Proxy ONLY external online images through the backend.
    if url.startswith('http'):
        import urllib.parse
        # We pass BOTH the high-res attempt and the original fallback to the proxy
        proxy_base = "/api/stream/thumbnail"
        query = f"?url={urllib.parse.quote(hi_res_url)}&fallback={urllib.parse.quote(url)}"
        return f"{proxy_base}{query}"
        
    return url

def resolve_piped_fallback(video_id):
    """Fallback: Resolve stream via a public Piped instance if yt-dlp is blocked."""
    # List of reliable public Piped instances
    instances = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.tokhmi.xyz",
        "https://api.piped.privacydev.net"
    ]
    for base_url in instances:
        try:
            resp = py_requests.get(f"{base_url}/streams/{video_id}", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                audio_streams = data.get('audioStreams', [])
                if audio_streams:
                    # Pick the highest quality m4a/mp4 stream
                    best = sorted(audio_streams, key=lambda x: x.get('bitrate', 0), reverse=True)[0]
                    return best.get('url'), "m4a (piped)"
        except Exception:
            continue
    return None, None

# Global cache for resolved stream URLs to make seeking/resuming instant
# videoId -> (url, format, expiry_timestamp)
_stream_cache = {}
_STREAM_CACHE_MAX = 500

def get_audio_stream_url(video_id):
    """
    Two-Tiered Resolution with Caching:
    1. Check memory cache (valid for 2 hours).
    2. Primarily uses yt-dlp with client spoofing.
    3. Fallbacks to Piped API.
    """
    import time
    now = time.time()
    
    # Check cache first
    if video_id in _stream_cache:
        url, fmt, expiry = _stream_cache[video_id]
        if now < expiry:
            return url, fmt
            
    url = f"https://music.youtube.com/watch?v={video_id}"
    
    # Tier 1: yt-dlp with spoofing
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web_embedded'],
                'skip': ['hls', 'dash']
            }
        },
        'socket_timeout': 10
    }
    
    res_url, res_fmt = None, None
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            res_url, res_fmt = info.get('url'), info.get('format')
    except Exception as e:
        print(f"[yt-dlp Resolution Failed] {video_id}: {e}")
        # Tier 2: Piped Fallback
        res_url, res_fmt = resolve_piped_fallback(video_id)
        
    if res_url:
        # Evict oldest entry if cache is full
        if len(_stream_cache) >= _STREAM_CACHE_MAX:
            oldest_key = min(_stream_cache, key=lambda k: _stream_cache[k][2])
            del _stream_cache[oldest_key]
        # Cache for 2 hours (YouTube links usually last 6, but we'll be safe)
        _stream_cache[video_id] = (res_url, res_fmt, now + 7200)
        
    return res_url, res_fmt

@stream_bp.route('/search', methods=['GET'])
@jwt_required()
def search_online():
    query = request.args.get('q')
    if not query:
        return jsonify({"message": "Query required"}), 400
        
    try:
        # filter="songs" guarantees ONLY official songs from YouTube Music catalog
        # This eliminates the video/cover/fan-upload problem entirely
        raw = ytmusic.search(query, filter="songs")
        
        results = []
        for item in raw[:15]:
            artists = ", ".join([a['name'] for a in item.get('artists', [])])
            thumbs = item.get('thumbnails', [])
            # Use highest-res thumbnail available
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
        print(f"[Stream Search Error] {e}")
        return jsonify({"message": "Search failed. Please try again."}), 500

@stream_bp.route('/audio/<video_id>', methods=['GET'])
@jwt_required()
def get_audio_url(video_id):
    """Resolves a videoId to a direct audio stream URL via yt-dlp."""
    try:
        audio_url, fmt = get_audio_stream_url(video_id)
        if not audio_url:
            return jsonify({"message": "Audio stream not found"}), 404
        return jsonify({"url": audio_url, "format": fmt}), 200
    except Exception as e:
        print(f"[Stream Audio Error] {e}")
        return jsonify({"message": "Failed to resolve audio stream"}), 500

@stream_bp.route('/proxy/<video_id>', methods=['GET'])
def proxy_audio(video_id):
    """
    Direct byte-level proxy. The browser's <audio> element hits this URL.
    Flask fetches the real audio from YouTube's CDN and pipes it through
    so the browser thinks it's a same-origin file -> no CORS, no tainted canvas.
    Supports HTTP Range requests for seeking.
    """
    try:
        audio_url, _ = get_audio_stream_url(video_id)
        if not audio_url:
            return Response("Not found", status=404)
        
        # Forward Range header for seeking support
        headers = {}
        range_header = request.headers.get('Range')
        if range_header:
            headers['Range'] = range_header
        
        upstream = py_requests.get(audio_url, stream=True, headers=headers, timeout=10)
        
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
    Proxies thumbnails with multi-tier caching (Memory -> Disk -> Redirect).
    Uses per-URL locking to prevent redundant upstream fetches.
    Fully crash-proof: every code path returns a valid Response.
    """
    import mimetypes

    target_url = request.args.get('url')
    fallback_url = request.args.get('fallback')
    if not target_url:
        return Response("URL required", status=400)

    # Lazy-import cache service (always available)
    try:
        from backend.services.cache_service import thumbnail_cache
    except Exception:
        # If even cache_service fails, just redirect to the original URL
        return _redirect_to_image(target_url, fallback_url)

    try:
        file_hash = thumbnail_cache._get_hash(target_url)
    except Exception:
        return _redirect_to_image(target_url, fallback_url)

    # --- 1. Hot Memory Cache (instant, no disk I/O) ---
    if file_hash in _memory_cache:
        cached_data = _memory_cache[file_hash]
        return Response(cached_data['content'], mimetype=cached_data['mime'], headers={
            'Cache-Control': 'public, max-age=604800, immutable',
            'ETag': file_hash[:16]
        })

    CACHE_HEADERS = {
        'Cache-Control': 'public, max-age=604800, immutable',
        'ETag': file_hash[:16],
    }

    # Handle browser 304 Not Modified
    if request.headers.get('If-None-Match') == file_hash[:16]:
        return Response('', status=304, headers=CACHE_HEADERS)

    # --- 2. Disk Cache ---
    try:
        cached_path = thumbnail_cache.get_cached_path(target_url)
        if cached_path:
            mime = mimetypes.guess_type(target_url)[0] or 'image/jpeg'
            with open(cached_path, 'rb') as f:
                content = f.read()
            _memory_cache[file_hash] = {'content': content, 'mime': mime}
            resp = Response(content, mimetype=mime)
            resp.headers.update(CACHE_HEADERS)
            return resp
    except Exception as e:
        print(f"[Thumbnail] Disk cache read error: {e}")

    # --- 3. Upstream Fetch (with per-URL locking) ---
    try:
        with _thumbnail_lock:
            if file_hash not in _fetch_locks:
                _fetch_locks[file_hash] = threading.Lock()
            lock = _fetch_locks[file_hash]
    except Exception:
        return _redirect_to_image(target_url, fallback_url)

    try:
        with lock:
            # Re-check caches inside lock (another thread may have just finished)
            if file_hash in _memory_cache:
                cached_data = _memory_cache[file_hash]
                return Response(cached_data['content'], mimetype=cached_data['mime'], headers=CACHE_HEADERS)

            try:
                cached_path = thumbnail_cache.get_cached_path(target_url)
                if cached_path:
                    mime = mimetypes.guess_type(target_url)[0] or 'image/jpeg'
                    with open(cached_path, 'rb') as f:
                        content = f.read()
                    _memory_cache[file_hash] = {'content': content, 'mime': mime}
                    return Response(content, mimetype=mime, headers=CACHE_HEADERS)
            except Exception:
                pass

            # Actually fetch from upstream
            common_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://music.youtube.com/',
            }

            content = None
            mime = 'image/jpeg'

            # Try primary URL
            try:
                resp = py_requests.get(target_url, headers=common_headers, timeout=8)
                if resp.status_code == 200 and len(resp.content) > 100:
                    content = resp.content
                    mime = resp.headers.get('Content-Type', 'image/jpeg')
            except Exception as e:
                print(f"[Thumbnail] Primary fetch failed: {e}")

            # Try fallback URL if primary failed
            if not content and fallback_url and fallback_url != target_url:
                try:
                    resp = py_requests.get(fallback_url, headers=common_headers, timeout=8)
                    if resp.status_code == 200 and len(resp.content) > 100:
                        content = resp.content
                        mime = resp.headers.get('Content-Type', 'image/jpeg')
                except Exception as e:
                    print(f"[Thumbnail] Fallback fetch failed: {e}")

            # Try Supabase cloud cache as last resort
            if not content:
                try:
                    from backend.services.storage_service import get_cached_thumbnail_url
                    cloud_url = get_cached_thumbnail_url(file_hash)
                    if cloud_url:
                        c_resp = py_requests.get(cloud_url, timeout=5)
                        if c_resp.status_code == 200 and len(c_resp.content) > 100:
                            content = c_resp.content
                            mime = c_resp.headers.get('Content-Type', 'image/jpeg')
                except Exception:
                    pass

            if content:
                # Save to disk cache
                try:
                    thumbnail_cache.save_to_cache(target_url, content)
                except Exception:
                    pass

                # Fill memory cache
                _memory_cache[file_hash] = {'content': content, 'mime': mime}

                # Background upload to Supabase (fire and forget)
                try:
                    from backend.services.storage_service import upload_thumbnail
                    threading.Thread(target=upload_thumbnail, args=(content, file_hash, mime), daemon=True).start()
                except Exception:
                    pass

                return Response(content, mimetype=mime, headers=CACHE_HEADERS)

    except Exception as e:
        print(f"[Thumbnail] Unexpected error: {e}")

    # --- 4. Ultimate Fallback: Redirect browser directly to the image URL ---
    # This avoids returning a 500/404 — the browser fetches directly from Google CDN
    return _redirect_to_image(target_url, fallback_url)


def _redirect_to_image(primary_url, fallback_url=None):
    """
    Instead of returning a 500 or 404, redirect the browser to fetch the image 
    directly from the CDN. This is the ultimate safety net.
    """
    from flask import redirect
    url = fallback_url or primary_url
    if url:
        return redirect(url, code=302)
    return Response("Not Found", status=404)
    
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
