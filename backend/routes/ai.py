import os
import json
import re
import random
import google.generativeai as genai
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from backend.models.song import Song

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/recommend', methods=['POST'])
@jwt_required()
def recommend_songs():
    data = request.get_json()
    
    if not data or 'prompt' not in data:
        return jsonify({"message": "Missing prompt"}), 400
        
    user_prompt = data.get('prompt')
    
    # Fallback: Random songs
    def get_fallback():
        all_s = Song.query.all()
        return random.sample(all_s, min(len(all_s), 10)) if all_s else []
        
    ai_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.environ.get("GOOGLE_API_KEY")
    
    if not api_key:
        fallback_songs = get_fallback()
        return jsonify([s.to_dict() for s in fallback_songs])
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(ai_model_name)
    
    all_songs = Song.query.all()
    
    # Context: Include 'path' so AI sees the folder structure 
    library_context = [
        {
            'id': s.id, 
            'title': s.title, 
            'artist': s.artist, 
            'path': s.src 
        } 
        for s in all_songs
    ]

    ai_prompt = f"""
    Role: Precise Music Librarian.
    User Request: "{user_prompt}"
    
    Library Data (List of Songs with Paths):
    {json.dumps(library_context)}
    
    INSTRUCTIONS:
    1. Analyze the 'path' field carefully. It contains the Genre/Language (e.g. 'Hindi', 'English', 'Rap').
    2. IF the user explicitly asks for a Language/Genre (e.g. "Hindi", "English", "Rap"):
       - You MUST ONLY select songs where that word appears in the 'path'.
       - Do NOT include songs from other folders.
    3. IF the user asks for a Vibe (e.g. "Sad", "Party"):
       - Select songs based on Title/Artist vibes.
    4. IF the request is "Mixed":
       - Pick a variety.
       
    Output: Return ONLY a raw JSON array of Song IDs. Example: [2, 9, 14]
    """

    try:
        response = model.generate_content(ai_prompt)
        match = re.search(r'\[.*\]', response.text.replace("```json", ""), re.DOTALL)
        ids = json.loads(match.group(0)) if match else []
        
        # Fetch songs preserving AI order
        result_songs = []
        for sid in ids:
            song = Song.query.get(sid)
            if song:
                result_songs.append(song.to_dict())
        
        if not result_songs: 
            return jsonify([s.to_dict() for s in get_fallback()])

        return jsonify(result_songs)
    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify([s.to_dict() for s in get_fallback()])

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
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(ai_model_name)
    
    all_songs = Song.query.all()
    library_context = [{'id': s.id, 'title': s.title, 'artist': s.artist, 'path': s.src} for s in all_songs]
    
    ai_prompt = f"""
    Categorize the following songs into the provided genres.
    
    Genres: {categories}
    
    Library Data:
    {json.dumps(library_context)}
    
    INSTRUCTIONS:
    1. Read the 'title', 'artist', and 'path' fields.
    2. Place each song ID into the best-matching genre array based on cultural context, vibe, and directory path.
    3. Output MUST be ONLY a raw JSON dictionary where keys are genres and values are arrays of song IDs.
    
    Output Example:
    {{"Rap": [3, 8], "Hindi": [1, 5, 9]}}
    """
    try:
        response = model.generate_content(ai_prompt)
        match = re.search(r'\{.*\}', response.text.replace("```json", ""), re.DOTALL)
        result = json.loads(match.group(0)) if match else {}
        return jsonify(result)
    except Exception as e:
        print(f"AI Categorize Error: {e}")
        return jsonify({})
