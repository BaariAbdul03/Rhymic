import os
import re
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import requests
from google import genai
from backend.models.song import Song, ArtistImage
from backend.extensions import db, limiter

artists_bp = Blueprint('artists', __name__)

def fetch_itunes_artist_image(name):
    """Fetch artist image from iTunes API (album art as proxy)."""
    try:
        clean_name = re.sub(r'(?i)\s*[\(\[]?(feat\.?|ft\.?|with|x|&).+', '', name).strip()
        url = "https://itunes.apple.com/search"
        params = {"term": clean_name, "entity": "musicArtist", "limit": 1}
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json().get("results", [])
        if data:
            album_params = {"term": clean_name, "entity": "album", "limit": 1}
            album_resp = requests.get(url, params=album_params, timeout=5)
            album_data = album_resp.json().get("results", [])
            if album_data:
                return album_data[0].get("artworkUrl100", "").replace("100x100bb", "600x600bb")
    except Exception as e:
        print(f"Error fetching image for {name}: {e}")
    return "/assets/default_cover.jpg"

@artists_bp.route('/images', methods=['POST'])
@jwt_required()
@limiter.limit("30 per minute; 200 per hour")
def get_artist_images():
    """Batch fetch artist images with DB caching."""
    data = request.get_json()
    if not data or 'artists' not in data:
        return jsonify({'error': 'Missing artists list'}), 400
        
    names = data['artists'][:20]
    results = {}
    
    for name in names:
        if not name or name == "Unknown Artist": continue
        
        # Check DB cache
        artist_db = ArtistImage.query.filter_by(artist_name=name).first()
        if artist_db:
            results[name] = artist_db.image_url
            continue
            
        # Fetch from iTunes
        img_url = fetch_itunes_artist_image(name)
        
        # Cache to DB
        new_artist = ArtistImage(artist_name=name, image_url=img_url)
        db.session.add(new_artist)
        results[name] = img_url
        
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        
    return jsonify(results)

@artists_bp.route('/<name>/profile', methods=['GET'])
@jwt_required()
def get_artist_profile(name):
    """
    Get an artist's profile using LOCAL library data.
    Returns the artist's songs from the local DB, image from iTunes, 
    and similar artists from Gemini AI.
    """
    clean_name = re.sub(r'(?i)\s*[\(\[]?(feat\.?|ft\.?|with|x|&).+', '', name).strip()
    
    # Get songs from local library by artist name (case-insensitive)
    local_songs = Song.query.filter(
        Song.artist.ilike(f"%{clean_name}%")
    ).all()
    songs_data = [s.to_dict() for s in local_songs]
    
    # Get image from iTunes
    img = fetch_itunes_artist_image(clean_name)
    
    # Get similar artists from Gemini
    similar = []
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key:
            client = genai.Client(api_key=api_key)
            res = client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=f"List 4 musical artists similar to '{clean_name}'. "
                         f"Reply ONLY with a comma separated list of names."
            )
            similar = [x.strip() for x in res.text.split(',')]
    except Exception as e:
        print(f"Error fetching similar artists for {clean_name}: {e}")
        
    return jsonify({
        "songs": songs_data,
        "image": img,
        "similar": similar[:4]
    })
