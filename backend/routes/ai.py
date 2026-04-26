import os
import json
import re
import random
import hashlib
import time
import requests as http
from google import genai
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from backend.models.song import Song

ai_bp = Blueprint('ai', __name__)

_dj_cache = {}
CACHE_TTL = 7200    # 2 hours
CACHE_MAX = 200     # max entries before evicting oldest

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_KEY = os.getenv("GROQ_API_KEY", "")

DJ_SYSTEM_PROMPT = (
    "You are a music expert DJ. Return ONLY a valid JSON array of song "
    "recommendations. No explanation, no markdown, no extra text. "
    'Format: [{"title": "Song Name", "artist": "Artist Name"}] '
    "Return exactly 8 songs that match the vibe described. "
    "CRITICAL RULES:\n"
    "1. ARTIST: If the user mentions an artist/singer, ALL results MUST be by that artist.\n"
    "2. LANGUAGE: If the user mentions a language (Hindi, English, etc.), ALL results MUST be in that language.\n"
    "3. ERA/GENRE: Strictly respect era (90s, 80s) and genre (Lofi, Rock, Party) requests.\n"
    "4. DIVERSITY: Ensure the 8 songs are distinct and high-quality."
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
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model": model,
        "response_format": {"type": "json_object"},
        "max_tokens": 400,
        "temperature": 0.8 if "70b" in model else 0.7,
        "messages": [
            {"role": "system", "content": DJ_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]
    }
    resp = http.post(GROQ_API_URL, json=body, headers=headers, timeout=15)
    remaining = resp.headers.get("x-ratelimit-remaining-requests", "?")
    print(f"[SmartDJ] Groq {model} — remaining requests today: {remaining}")
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    if isinstance(parsed, list):
        return parsed
    return parsed.get("songs", list(parsed.values())[0])

def _resolve_tracks(tracks):
    from backend.routes.stream import ytmusic, fix_thumbnail
    import concurrent.futures
    def resolve_track(track):
        query = f"{track.get('title', '')} {track.get('artist', '')}"
        try:
            search_results = ytmusic.search(query, filter="songs", limit=1)
            if not search_results: return None
            
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

    result_songs = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(resolve_track, t) for t in tracks]
        for future in concurrent.futures.as_completed(futures):
            data = future.result()
            if data:
                result_songs.append(data)
    return result_songs

def _call_gemini(user_prompt):
    ai_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise Exception("No API Key API")
        
    client = genai.Client(api_key=api_key)

    ai_prompt = f"""
    Role: Precise Music Librarian with access to the entire world's music.
    User Request: "{user_prompt}"
    
    INSTRUCTIONS:
    1. Act as a world-class DJ and create the perfect playlist of 10 songs based on the vibe.
    2. STRICT REQUIREMENT: Only suggest songs in the specific language or genre requested. If the user asks for 'Hindi', 'Punjabi', or 'K-Pop', do NOT include English or Western songs.
    3. PRIORITIZE: Choose fresh, popular, and high-quality tracks suitable for online streaming.
    4. Respond ONLY with a raw JSON valid object containing two keys: "title" (a 2-4 word playlist name) and "tracks" (an array of 10 objects, each with "title" and "artist").
    
    Output Example:
    {{"title": "Midnight Vibe", "tracks": [{{"title": "Blinding Lights", "artist": "The Weeknd"}}, {{"title": "Starboy", "artist": "The Weeknd"}}]}}
    """
    response = client.models.generate_content(model=ai_model_name, contents=ai_prompt)
    if not response or not response.text:
        raise Exception("Empty AI response")

    match = re.search(r'\{.*\}', response.text.replace("```json", "").replace("```", ""), re.DOTALL)
    result_dict = json.loads(match.group(0)) if match else {"tracks": []}
    tracks = result_dict.get("tracks", [])
    if not tracks:
         raise Exception("No tracks in JSON")
    
    resolved = _resolve_tracks(tracks)
    if not resolved:
        raise Exception("No tracks resolved")
    return resolved

def _local_keyword_search(prompt):
    all_s = Song.query.all()
    # Keeping existing random fallback for simplicity and stability if local search breaks.
    # The frontend actually performs keyword matching itself if backend fails.
    fallback_songs = random.sample(all_s, min(len(all_s), 10)) if all_s else []
    return [s.to_dict() for s in fallback_songs]

@ai_bp.route('/recommend', methods=['POST'])
@jwt_required()
def recommend_songs():
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

    # Layer 1 — Groq 70B
    try:
        raw_songs = _call_groq(prompt, "llama-3.3-70b-versatile")
        songs = _resolve_tracks(raw_songs)
        if not songs: raise Exception("Resolution failed")
        _cache_set(cache_key, songs)
        return jsonify({
            "title": prompt.title(),
            "songs": songs, 
            "source": "groq-70b", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] Groq 70B failed: {e} — trying 8B")

    # Layer 2 — Groq 8B
    try:
        raw_songs = _call_groq(prompt, "llama-3.1-8b-instant")
        songs = _resolve_tracks(raw_songs)
        if not songs: raise Exception("Resolution failed")
        _cache_set(cache_key, songs)
        return jsonify({
            "title": prompt.title(),
            "songs": songs, 
            "source": "groq-8b", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] Groq 8B failed: {e} — trying Gemini")

    # Layer 3 — Gemini (preserve existing logic exactly)
    try:
        songs = _call_gemini(prompt)
        _cache_set(cache_key, songs)
        return jsonify({
            "title": prompt.title(),
            "songs": songs, 
            "source": "gemini", 
            "cached": False
        })
    except Exception as e:
        print(f"[SmartDJ] Gemini failed: {e} — using local search")

    # Layer 4 — Local keyword search (preserve existing logic exactly)
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
def categorize_genres():
    data = request.get_json()
    if not data or 'categories' not in data:
        return jsonify({"message": "Missing categories list"}), 400
        
    categories = data.get('categories')
    ai_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.environ.get("GOOGLE_API_KEY")

    if not api_key:
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
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=ai_model_name, contents=ai_prompt)
        match = re.search(r'\{.*\}', response.text.replace("```json", ""), re.DOTALL)
        result = json.loads(match.group(0)) if match else {}
        return jsonify(result)
    except Exception as e:
        print(f"AI Categorize Error: {e}")
        return jsonify({})
