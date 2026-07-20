from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.extensions import db, limiter
from backend.models.song import Song
from backend.models.mood import SongMood
import os
from google import genai

mood_bp = Blueprint('mood', __name__)

MOODS = ["Energetic", "Chill", "Melancholy", "Euphoric", "Focus", "Romantic"]

@mood_bp.route('/<string:song_id>', methods=['GET'])
@jwt_required()
@limiter.limit("60 per minute; 300 per hour")
def get_song_mood(song_id):
    # Determine the lookup logic based on whether song_id is an integer or string (youtube_id)
    song = None
    if song_id.isdigit():
        song = Song.query.get(int(song_id))
    
    if not song:
        song = Song.query.filter_by(youtube_id=song_id).first()
    
    # NEW: Fallback metadata for songs not yet in DB (common for online search results)
    title = request.args.get('title')
    artist = request.args.get('artist')

    if not song and not (title and artist):
        return jsonify({"song_id": song_id, "mood": "Chill", "error": "Song not found in DB and no metadata provided"}), 404

    # Check cache first using the database ID if we have one
    if song:
        cached_mood = SongMood.query.filter_by(song_id=song.id).first()
        if cached_mood:
            return jsonify({"song_id": song_id, "mood": cached_mood.mood, "cached": True}), 200
    
    # Use Gemini to detect mood (Using song object or query params)
    t = song.title if song else title
    a = song.artist if song else artist
    s = song.src if song else "Online Stream"

    prompt = f"""
    Analyze the following song and determine its primary mood based on its title and artist.
    Title: {t}
    Artist: {a}
    Path info: {s}

    You must select EXACTLY ONE of these moods: {', '.join(MOODS)}.
    Respond ONLY with the mood name. Nothing else.
    """
    
    try:
        ai_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        api_key = os.environ.get("GOOGLE_API_KEY")
        
        if not api_key:
            print("[AI Mood] Missing GOOGLE_API_KEY")
            return jsonify({"song_id": song_id, "mood": "Chill", "cached": False, "error": "No API Key"}), 200
            
        client = genai.Client(api_key=api_key)
        
        print(f"[AI Mood] Analyzing: {t} by {a}...")
        response = client.models.generate_content(model=ai_model_name, contents=prompt)
        
        if not response or not response.text:
            print(f"[AI Mood] Empty response or Safety Block for: {t}")
            return jsonify({"song_id": song_id, "mood": "Chill", "cached": False, "error": "Empty AI response"}), 200

        ai_mood = response.text.strip()
        print(f"[AI Mood] Raw AI Response: {ai_mood}")
        
        # Validation: check if response contains one of the moods
        matched_mood = "Chill" # Default fallback
        for m in MOODS:
            if m.lower() in ai_mood.lower():
                matched_mood = m
                break
        
        print(f"[AI Mood] Matched: {matched_mood}")
                
        # Cache it ONLY IF we have a DB song entry (due to foreign key constraint)
        if song:
            try:
                new_mood = SongMood(song_id=song.id, mood=matched_mood)
                db.session.add(new_mood)
                db.session.commit()
            except Exception as cache_err:
                db.session.rollback()
                # Another request already inserted — fetch from cache
                cached = SongMood.query.filter_by(song_id=song.id).first()
                matched_mood = cached.mood if cached else matched_mood
        
        return jsonify({"song_id": song_id, "mood": matched_mood, "cached": False}), 200
        
    except Exception as e:
        print(f"[AI Mood] Error: {e}")
        return jsonify({"song_id": song_id, "mood": "Chill", "cached": False, "error": str(e)}), 200
