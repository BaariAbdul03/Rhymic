from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required
import re
import yt_dlp
from ytmusicapi import YTMusic
import requests as py_requests

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

def get_audio_stream_url(video_id):
    """
    Two-Tiered Resolution:
    1. Primarily uses yt-dlp with client spoofing (Android/MWeb) to bypass bot challenges.
    2. Automatically fallbacks to Piped API if YouTube blocks the server IP.
    """
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
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url'), info.get('format')
    except Exception as e:
        print(f"[yt-dlp Resolution Failed] {video_id}: {e}")
        # Tier 2: Piped Fallback
        return resolve_piped_fallback(video_id)

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
    Proxies thumbnails to bypass CORS/Referrer blocks.
    Supports persistent cloud caching via Supabase + local disk fallback.
    """
    from backend.services.cache_service import thumbnail_cache
    from backend.services.storage_service import upload_thumbnail, get_cached_thumbnail_url
    from flask import send_file, redirect
    import mimetypes

    target_url = request.args.get('url')
    if not target_url:
        return Response("URL required", status=400)
    
    file_hash = thumbnail_cache._get_hash(target_url)

    # Tier 1: Check Local Disk Cache (Fastest)
    cached_path = thumbnail_cache.get_cached_path(target_url)
    if cached_path:
        mime = mimetypes.guess_type(target_url)[0] or 'image/jpeg'
        return send_file(cached_path, mimetype=mime)

    # Tier 2: Check Supabase (Persistence)
    # Note: We only do this if local cache missed to save network time
    cloud_url = get_cached_thumbnail_url(file_hash)
    if cloud_url:
        # Check if actually reachable (simple 1s HEAD request)
        try:
            head = py_requests.head(cloud_url, timeout=1)
            if head.status_code == 200:
                return redirect(cloud_url)
        except Exception:
            pass

    # Tier 3: Fetch and Save to Cache
    try:
        common_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://music.youtube.com/',
        }

        session = py_requests.Session()
        resp = session.get(target_url, headers=common_headers, stream=True, timeout=10)
        
        original_url = request.args.get('fallback')
        if resp.status_code != 200 and original_url and original_url != target_url:
            resp.close()
            resp = session.get(original_url, headers=common_headers, stream=True, timeout=10)

        if resp.status_code != 200:
            return Response(f"Upstream error: {resp.status_code}", status=resp.status_code)
            
        # 1. Save to Local Cache for this session
        content = resp.content # We need full content for Supabase upload too
        full_path = thumbnail_cache.save_to_cache(target_url, content)
        
        # 2. Upload to Supabase for all sessions
        mime = resp.headers.get('Content-Type', 'image/jpeg')
        upload_thumbnail(content, file_hash, mime)

        return Response(content, status=200, headers={'Content-Type': mime})

    except Exception as e:
        print(f"[Thumbnail Proxy Error] {e}")
        return Response("Proxy internal error", status=504)
    
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
