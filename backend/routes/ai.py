import json
import random
import hashlib
import time
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from backend.extensions import limiter
from backend.models.song import Song
from backend.services import ai_service
from backend.services.ai_service import GroqError

ai_bp = Blueprint('ai', __name__)

_dj_cache = {}
CACHE_TTL = 7200    # 2 hours
CACHE_MAX = 200     # max entries before evicting oldest

DJ_SYSTEM_PROMPT = (
    "You are a music expert DJ. Return ONLY a valid JSON object of song "
    "recommendations. No explanation, no markdown, no extra text. "
    'Format: {"songs": [{"title": "Song Name", "artist": "Artist Name"}]} '
    "Return exactly 8 songs that match the vibe described. "
    "CRITICAL RULES:\n"
    "1. ARTIST: If the user mentions an artist/singer, ALL results MUST be by that artist.\n"
    "2. LANGUAGE: If the user mentions a language (Hindi, English, etc.), ALL results MUST be in that language.\n"
    "3. ERA/GENRE: Strictly respect era (90s, 80s) and genre (Lofi, Rock, Party) requests.\n"
    "4. DIVERSITY: Ensure the 8 songs are distinct and high-quality."
)

DJ_USER_INSTRUCTIONS = (
    "Generate the playlist for this request. Respond ONLY with JSON in the "
    "specified format:\nRequest: "
)


def _cache_get(key):
    entry = _dj_cache.get(key)
    if entry and (time.time() - entry["timestamp"]) < CACHE_TTL:
        entry["hits"] += 1
        return entry["result"]
    return None

def _cache_set(key, result):
    if len(_dj_cache) >= CACHE_MAX:
        oldest = min(_dj_cache, key=lambda k: _dj_cache[k]["timestamp"])
        del _dj_cache[oldest]
    _dj_cache[key] = {"result": result, "timestamp": time.time(), "hits": 0}

def _call_groq(prompt, model):
    """Request 8 songs from a Groq model and return a [{title, artist}] list."""
    parsed = ai_service.chat_json(
        DJ_USER_INSTRUCTIONS + prompt,
        system=DJ_SYSTEM_PROMPT,
        model=model,
        max_tokens=1200,
        temperature=0.8,
        json_mode=True,
    )
    songs = ai_service.extract_songs_array(parsed)
    if not songs:
        raise GroqError("No songs in AI response")
    return songs

def _resolve_tracks(tracks):
    from backend.routes.stream import ytmusic, fix_thumbnail
    import concurrent.futures
    local_tracks = {
        (song.title.casefold().strip(), (song.artist or '').casefold().strip()): song.to_dict()
        for song in Song.query.filter_by(source='local')
    }

    def resolve_track(track):
        if not isinstance(track, dict):
            return None
        title = str(track.get('title') or '').strip()
        artist = str(track.get('artist') or '').strip()
        if not title:
            return None
        local = local_tracks.get((title.casefold(), artist.casefold()))
        if local:
            return local
        query = f"{title} {artist}".strip()
        try:
            search_results = ytmusic.search(query, filter="songs", limit=1)
            if not search_results or not search_results[0].get("videoId"):
                return None
            
            res = search_results[0]
            authors = ", ".join([a['name'] for a in res.get('artists', [])])
            thumbs = res.get('thumbnails', [])
            cover = fix_thumbnail(thumbs[-1]['url'] if thumbs else '')
            
            return {
                "id": res.get("videoId"),
                "title": res.get("title", "Unknown"),
                "artist": authors or "Unknown",
                "cover": cover,
                "src": f"/api/stream/proxy/{res.get('videoId')}",
                "source": "online"
            }
        except Exception as e:
            print(f"YT Resolution Error for {query}: {e}")
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        return [song for song in executor.map(resolve_track, tracks[:8]) if song]

def _local_keyword_search(prompt):
    all_s = Song.query.filter_by(source='local').all()
    words = {word for word in prompt.casefold().split() if len(word) > 2}
    random.shuffle(all_s)
    all_s.sort(key=lambda song: sum(word in f"{song.title} {song.artist} {song.src}".casefold() for word in words), reverse=True)
    fallback_songs = all_s[:10]
    return [s.to_dict() for s in fallback_songs]

@ai_bp.route('/recommend', methods=['POST'])
@jwt_required()
@limiter.limit("10 per minute; 50 per hour")
def recommend_songs():
    if not ai_service.is_configured():
        print("[SmartDJ] GROQ_API_KEY missing — using local search")
        data = request.get_json() or {}
        prompt = (data.get("prompt") or "Mix").strip()
        songs = _local_keyword_search(prompt)
        return jsonify({
            "title": f"Local Mix: {prompt.title()}",
            "songs": songs,
            "source": "local",
            "cached": False
        })

    data = request.get_json()
    prompt = (data.get("prompt") or "").strip()
    regenerate = data.get("regenerate", False)
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    cache_key = hashlib.md5(prompt.lower().encode()).hexdigest()
    
    if not regenerate:
        cached = _cache_get(cache_key)
        if cached:
            return jsonify({
                "title": prompt.title(),
                "songs": cached, 
                "source": "cache", 
                "cached": True
            })

    # Layer 1 — Groq GPT-OSS 120B (quality)
    try:
        raw_songs = _call_groq(prompt, ai_service._primary_model())
        songs = _resolve_tracks(raw_songs)
        if not songs: raise Exception("Resolution failed")
        _cache_set(cache_key, songs)
        return jsonify({
            "title": prompt.title(),
            "songs": songs, 
            "source": "groq-120b", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] Groq 120B failed: {e} — trying 20B")

    # Layer 2 — Groq GPT-OSS 20B (fast fallback)
    try:
        raw_songs = _call_groq(prompt, ai_service._small_model())
        songs = _resolve_tracks(raw_songs)
        if not songs: raise Exception("Resolution failed")
        _cache_set(cache_key, songs)
        return jsonify({
            "title": prompt.title(),
            "songs": songs, 
            "source": "groq-20b", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] Groq 20B failed: {e} — using local search")

    # Layer 3 — Local keyword search
    try:
        songs = _local_keyword_search(prompt)
        return jsonify({
            "title": f"Local Mix: {prompt.title()}",
            "songs": songs, 
            "source": "local", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] All layers failed: {e}")
        return jsonify({"error": "DJ is taking a break, try again shortly"}), 503

@ai_bp.route('/categorize-genres', methods=['POST'])
@jwt_required()
@limiter.limit("5 per minute; 20 per hour")
def categorize_genres():
    data = request.get_json()
    if not data or 'categories' not in data:
        return jsonify({"message": "Missing categories list"}), 400
        
    categories = data.get('categories')

    if not ai_service.is_configured():
        return jsonify({})

    all_songs = Song.query.all()
    library_context = [{'id': s.id, 'title': s.title, 'artist': s.artist, 'path': s.src} for s in all_songs]

    ai_prompt = f"""
    Categorize the following songs into the provided genres.

    Genres: {categories}

    Library Data:
    {json.dumps(library_context)}

    INSTRUCTIONS:
    1. Read 'title', 'artist', and 'path' fields.
    2. KEY RULE: If the 'path' starts with '/api/stream/proxy/', it is an ONLINE STREAM. Categorize these based solely on the culture, language, and genre of the title/artist (e.g., Arijit Singh is 'Hindi', Alan Walker is 'English' or 'Electronic').
    3. Place each song ID into the best-matching genre array.
    4. Output MUST be ONLY a raw JSON dictionary where keys are genres and values are arrays of song IDs.

    Output Example:
    {{"Rap": [3, 8], "Hindi": ["vID-123", "vID-456"]}}
    """
    try:
        result = ai_service.chat_json(ai_prompt, max_tokens=2000, temperature=0.2)
        return jsonify(result)
    except Exception as e:
        print(f"AI Categorize Error: {e}")
        return jsonify({})
