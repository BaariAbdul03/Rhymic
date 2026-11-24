from flask import Blueprint, jsonify, request, Response, redirect
from urllib.parse import urlsplit
from flask_jwt_extended import jwt_required
from ytmusicapi import YTMusic
import os
import requests as py_requests
import time
from backend.extensions import limiter
from backend.services.online_provider import get_audio_stream_url, get_online_provider_status

_category_cache = {}
_CATEGORY_CACHE_TTL = 1800

stream_bp = Blueprint('stream', __name__)

# Singleton YTMusic instance (no auth needed for public search)
ytmusic = YTMusic()

CATEGORY_QUERIES = {
    "Hindi": "latest hindi bollywood official songs",
    "English": "popular english pop official audio",
    "Rap": "popular rap hip hop official songs",
    "Modern": "modern pop hits official audio",
    "Retro Classics": "retro classic official songs",
    "Romantic": "romantic love official songs",
    "Chill": "chill lofi official songs",
    "Workout": "workout energetic official songs",
    "Focus": "focus instrumental official songs",
}

BLOCKED_ONLINE_TERMS = (
    "mashup", "party mashup", "non stop", "non-stop", "jukebox", "dj mix",
    "mega mix", "megamix", "remix", "slowed", "reverb", "nightcore",
    "karaoke", "cover version", "instrumental karaoke", "reaction"
)


def _is_low_quality_song(item):
    title = item.get('title') or ''
    artists = " ".join([a.get('name', '') for a in item.get('artists', []) if a.get('name')])
    album = item.get('album') or {}
    album_name = album.get('name', '') if isinstance(album, dict) else ''
    text = f"{title} {artists} {album_name}".lower()
    if any(term in text for term in BLOCKED_ONLINE_TERMS):
        return True
    if not item.get('duration'):
        return True
    return False

def fix_thumbnail(url):
    """Return an approved CDN image URL sized for the player and song cards."""
    try:
        parsed = urlsplit(url or "")
        host = parsed.hostname or ""
    except ValueError:
        return ""
    if parsed.scheme != "https" or parsed.netloc != host:
        return ""
    if host.endswith((".googleusercontent.com", ".ggpht.com")):
        path = parsed.path.split("=", 1)[0] + "=s512"
        return parsed._replace(path=path).geturl()
    if host.endswith(".ytimg.com"):
        return url
    return ""


def _format_ytmusic_song(item, category=None):
    video_id = item.get('videoId')
    if not video_id or _is_low_quality_song(item):
        return None

    artists = ", ".join([a.get('name', '') for a in item.get('artists', []) if a.get('name')])
    thumbs = item.get('thumbnails', [])
    album = item.get('album', {})

    return {
        "id": video_id,
        "title": item.get('title'),
        "artist": artists or "Unknown Artist",
        "cover": fix_thumbnail(thumbs[-1]['url']) if thumbs else '',
        "duration": item.get('duration'),
        "album": album.get('name') if album else None,
        "source": "online",
        "src": f"/api/stream/proxy/{video_id}",
        "genre": category,
        "category": category,
    }


def _search_category(category, limit=10):
    query = CATEGORY_QUERIES.get(category, f"{category} songs")
    cache_key = f"{category}:{limit}"
    cached = _category_cache.get(cache_key)
    now = time.time()
    if cached and now < cached["expires"]:
        return cached["songs"]

    raw = ytmusic.search(query, filter="songs", limit=max(limit * 3, 20))
    songs = []
    seen = set()
    for item in raw:
        song = _format_ytmusic_song(item, category)
        if not song or song["id"] in seen:
            continue
        seen.add(song["id"])
        songs.append(song)
        if len(songs) >= limit:
            break

    _category_cache[cache_key] = {
        "songs": songs,
        "expires": now + _CATEGORY_CACHE_TTL,
    }
    return songs

@stream_bp.route('/search', methods=['GET'])
@jwt_required()
@limiter.limit("30 per minute; 200 per hour")
def search_online():
    query = request.args.get('q')
    if not query:
        return jsonify({"message": "Query required"}), 400
        
    try:
        # filter="songs" guarantees ONLY official songs from YouTube Music catalog
        # This eliminates the video/cover/fan-upload problem entirely
        raw = ytmusic.search(f"{query} official song", filter="songs", limit=25)
        
        results = []
        for item in raw:
            song = _format_ytmusic_song(item)
            if song:
                results.append(song)
            if len(results) >= 15:
                break
            
        return jsonify(results), 200
    except Exception as e:
        print(f"[Stream Search Error] {e}")
        return jsonify({"message": "Search failed. Please try again."}), 500

@stream_bp.route('/status', methods=['GET'])
@jwt_required()
def stream_status():
    return jsonify(get_online_provider_status()), 200

@stream_bp.route('/categories', methods=['GET'])
@jwt_required()
@limiter.limit("10 per minute; 60 per hour")
def get_online_categories():
    """Returns online songs grouped by the requested Discover categories."""
    names_param = request.args.get('names', '')
    categories = [name.strip() for name in names_param.split(',') if name.strip()]
    if not categories:
        categories = ["Hindi", "English", "Rap", "Modern", "Retro Classics", "Romantic"]
    categories = categories[:12]

    limit = request.args.get('limit', 10, type=int)
    limit = max(1, min(limit, 15))

    grouped = {}
    errors = {}
    for category in categories:
        try:
            grouped[category] = _search_category(category, limit=limit)
        except Exception as exc:
            print(f"[Stream Categories Error] {category}: {exc}")
            grouped[category] = []
            errors[category] = "unavailable"

    return jsonify({
        "categories": grouped,
        "errors": errors,
        "source": "online"
    }), 200

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
# NOTE: No @jwt_required() here — browser <audio> elements make direct GET
# requests without Authorization headers. Auth for media requires signed URLs
# or cookie-based sessions.
def proxy_audio(video_id):
    """
    Direct byte-level proxy. The browser's <audio> element hits this URL.
    Flask fetches the real audio from YouTube's CDN and pipes it through
    so the browser thinks it's a same-origin file -> no CORS, no tainted canvas.
    Supports HTTP Range requests for seeking.
    
    Graceful Degradation Strategy (ordered):
    1. Try server-side resolution (resolver -> Piped -> yt-dlp)
    2. If all fail, return a placeholder response that triggers frontend fallback
       (frontend will show "Play on YouTube" button)
    """
    try:
        audio_url, fmt = get_audio_stream_url(video_id)
        if audio_url:
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
        
        # All server-side methods failed — return a special status that tells
        # the frontend to use the YouTube Music fallback
        print(f"[Stream Proxy] All layers returned None for {video_id} — falling back to YouTube redirect")
        return jsonify({
            "error": "stream_unavailable",
            "message": "Server-side stream resolution failed. Try playing directly on YouTube.",
            "fallback_url": f"https://music.youtube.com/watch?v={video_id}",
            "video_id": video_id
        }), 503
            
    except Exception as e:
        print(f"[Stream Proxy Error] {e}")
        return jsonify({
            "error": "stream_error",
            "message": "Stream error occurred.",
            "fallback_url": f"https://music.youtube.com/watch?v={video_id}",
            "video_id": video_id
        }), 500

@stream_bp.route('/thumbnail', methods=['GET'])
def proxy_thumbnail():
    """Keep saved artwork URLs working without fetching images through Render."""
    url = fix_thumbnail(request.args.get("url")) or fix_thumbnail(request.args.get("fallback"))
    if not url:
        return Response("Thumbnail unavailable", status=404, mimetype="text/plain")
    response = redirect(url)
    response.cache_control.public = True
    response.cache_control.max_age = 3600
    return response


@stream_bp.route('/trending', methods=['GET'])
@jwt_required()
def get_trending():
    """Returns trending songs from YouTube Music charts."""
    try:
        raw = ytmusic.search("trending official songs 2026", filter="songs", limit=35)
        
        results = []
        for item in raw:
            song = _format_ytmusic_song(item, "Trending")
            if song:
                results.append(song)
            if len(results) >= 15:
                break
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
            title = t.get('title') or ''
            artist_text = " ".join([a.get('name', '') for a in t.get('artists', [])])
            if not t.get('videoId') or any(term in f"{title} {artist_text}".lower() for term in BLOCKED_ONLINE_TERMS):
                continue
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
                "source": "online",
                "src": f"/api/stream/proxy/{t.get('videoId')}"
            })
        return jsonify(results), 200
    except Exception as e:
        print(f"[Related Error] {e}")
        return jsonify([]), 200
