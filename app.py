from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from urllib.parse import unquote
from datetime import timedelta
from sqlalchemy import func
import os
import json
import re
import time
import threading
import google.generativeai as genai
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError
import random
import requests # <-- NEW
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename # <-- Import this

# Load environment variables
load_dotenv()

app = Flask(__name__)

# --- CONFIGURATION ---
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'rhymic-react', 'public', 'assets'))
# Define Profile Upload Folder
PROFILE_DIR = os.path.join(ASSETS_DIR, 'profiles')
if not os.path.exists(PROFILE_DIR): os.makedirs(PROFILE_DIR)
app.config['SECRET_KEY'] = 'your-secret-key-keep-it-safe'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30) # 30 Day Session

CORS(app)

# 2. INITIALIZE LIMITER
limiter = Limiter(
    get_remote_address,
    app=app,
    # Allow 2000 requests per hour (plenty for loading images)
    default_limits=["10000 per day", "2000 per hour"], 
    storage_uri="memory://"
)

# Configure AI
ai_model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel(ai_model_name)
else:
    print("WARNING: GOOGLE_API_KEY not found. AI features will fail.")
    model = None

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- DATABASE MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    # NEW COLUMN
    profile_pic = db.Column(db.String(300), default="")

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    artist = db.Column(db.String(100), default="Unknown Artist")
    src = db.Column(db.String(300), nullable=False, unique=True)
    cover = db.Column(db.String(300), default="/assets/default_cover.jpg")

class Playlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    is_system = db.Column(db.Boolean, default=False)

class PlaylistSong(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('playlist.id'), nullable=False)
    song_id = db.Column(db.Integer, db.ForeignKey('song.id'), nullable=False)

class LikedSong(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    song_id = db.Column(db.Integer, db.ForeignKey('song.id'), nullable=False)

# NEW MODEL: Cache for Artist Images
class ArtistImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    artist_name = db.Column(db.String(100), unique=True, nullable=False)
    image_url = db.Column(db.String(500), nullable=False)

# --- SCANNER ---
def scan_library():
    music_dir = os.path.join(ASSETS_DIR, 'music')
    if not os.path.exists(music_dir): return

    for root, dirs, files in os.walk(music_dir):
        if root == music_dir: continue
        
        rel_path = os.path.relpath(root, music_dir)
        categories = rel_path.split(os.sep)
        
        folder_cover = "/assets/default_cover.jpg"
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                rel_path_img = os.path.relpath(os.path.join(root, file), os.path.join(ASSETS_DIR, '..'))
                folder_cover = f"/{rel_path_img.replace(os.sep, '/')}"
                break

        for file in files:
            if file.lower().endswith('.mp3'):
                rel_path_file = os.path.relpath(os.path.join(root, file), os.path.join(ASSETS_DIR, '..'))
                web_src = f"/{rel_path_file.replace(os.sep, '/')}"
                
                base_name = os.path.splitext(file)[0]
                clean_title = base_name
                clean_artist = "Unknown Artist"

                if ' - ' in base_name:
                    parts = base_name.split(' - ', 1)
                    clean_artist = parts[0].strip()
                    clean_title = parts[1].strip()

                song = Song.query.filter_by(src=web_src).first()
                
                if not song:
                    web_cover = folder_cover
                    for ext in ['.jpg', '.jpeg', '.png']:
                        if os.path.exists(os.path.join(root, base_name + ext)):
                            rel_c = os.path.relpath(os.path.join(root, base_name + ext), os.path.join(ASSETS_DIR, '..'))
                            web_cover = f"/{rel_c.replace(os.sep, '/')}"
                            break
                    
                    song = Song(title=clean_title, artist=clean_artist, src=web_src, cover=web_cover)
                    db.session.add(song)
                    db.session.commit()

                for category in categories:
                    if not category: continue
                    playlist = Playlist.query.filter_by(name=category, is_system=True).first()
                    if not playlist:
                        playlist = Playlist(name=category, is_system=True, user_id=None)
                        db.session.add(playlist)
                        db.session.commit()
                    
                    link = PlaylistSong.query.filter_by(playlist_id=playlist.id, song_id=song.id).first()
                    if not link:
                        link = PlaylistSong(playlist_id=playlist.id, song_id=song.id)
                        db.session.add(link)
                        db.session.commit()

# --- UPDATED: SAFE METADATA FIXER ---
def auto_fix_metadata(limit=5):
    """
    Fixes up to 'limit' songs on startup.
    Running this sequentially avoids Database Locks.
    """
    if not model: return

    # Check for songs with bad metadata
    messy_songs = Song.query.filter(
        (Song.artist == "Unknown Artist") | (Song.artist == "Unknown")
    ).limit(limit).all() # Limit the batch size
    
    if not messy_songs:
        return

    for song in messy_songs:
        filename = os.path.basename(song.src)
        
        ai_prompt = f"""
        Filename: "{filename}"
        Task: Identify 'Artist' and 'Title'.
        Rules: Use your music knowledge. Remove 'official', 'lyrics', 'mp3'.
        Return JSON ONLY: {{"artist": "Name", "title": "Title"}}
        """
        
        try:
            response = model.generate_content(ai_prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            match = re.search(r'\{.*\}', clean_text, re.DOTALL)
            
            if match:
                data = json.loads(match.group(0))
                if data.get('artist') and data['artist'] != 'Unknown':
                    song.artist = data['artist']
                    song.title = data['title']
                    db.session.commit() # Commit each success individually
            
            # Small pause to be nice to the API
            time.sleep(2)
            
        except Exception as e:
            print(f"   -> Failed: {e}")
            continue

# --- HELPER: FETCH ARTIST IMAGE ---
def get_artist_image(artist_name):
    """
    Checks DB for cached image. If missing, fetches from Deezer API and saves it.
    """
    # 1. Check Cache
    cached = ArtistImage.query.filter_by(artist_name=artist_name).first()
    if cached:
        return cached.image_url
    
    # 2. Fetch from Deezer
    try:
        # Search for the artist
        response = requests.get(f'https://api.deezer.com/search/artist?q={artist_name}')
        data = response.json()
        
        if data and 'data' in data and len(data['data']) > 0:
            # Get the first result's XL picture
            image_url = data['data'][0].get('picture_xl') or data['data'][0].get('picture_medium')
            
            if image_url:
                # 3. Save to Cache
                new_entry = ArtistImage(artist_name=artist_name, image_url=image_url)
                db.session.add(new_entry)
                db.session.commit()
                return image_url
                
    except Exception as e:
        print(f"Deezer API Error: {e}")
    
    # 4. Fallback (Use local default if online fetch fails)
    return '/assets/default_cover.jpg'

# --- ROUTES ---

@app.route('/')
def home(): return "Rhymic Backend Running"

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    try: return send_from_directory(ASSETS_DIR, unquote(filename))
    except: 
        if filename.endswith(('.jpg', '.png')): return send_from_directory(ASSETS_DIR, 'default_cover.jpg')
        return "Not Found", 404

# --- AI ROUTE ---
@app.route('/api/ai/recommend', methods=['POST'])
@jwt_required()
def recommend_songs():
    # Fallback: Random songs
    def get_fallback():
        all_s = Song.query.all()
        return random.sample(all_s, min(len(all_s), 10)) if all_s else []
    
    if not model: return jsonify([{'id': s.id, 'title': s.title, 'artist': s.artist, 'src': s.src, 'cover': s.cover} for s in get_fallback()])

    data = request.get_json()
    user_prompt = data.get('prompt')
    
    all_songs = Song.query.all()
    
    # Context: Include 'path' so AI sees the folder structure (e.g., "assets/music/Hindi/Song.mp3")
    library_context = [
        {
            'id': s.id, 
            'title': s.title, 
            'artist': s.artist, 
            'path': s.src 
        } 
        for s in all_songs
    ]

    # --- STRICTER PROMPT ---
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
                result_songs.append({
                    'id': song.id, 
                    'title': song.title, 
                    'artist': song.artist, 
                    'src': song.src, 
                    'cover': song.cover
                })
        
        if not result_songs: return jsonify([{'id': s.id, 'title': s.title, 'artist': s.artist, 'src': s.src, 'cover': s.cover} for s in get_fallback()])

        return jsonify(result_songs)
    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify([{'id': s.id, 'title': s.title, 'artist': s.artist, 'src': s.src, 'cover': s.cover} for s in get_fallback()])

# --- STANDARD ROUTES ---
@app.route('/api/songs', methods=['GET'])
def get_songs():
    return jsonify([{'id': s.id, 'title': s.title, 'artist': s.artist, 'src': s.src, 'cover': s.cover} for s in Song.query.all()])

@app.route('/api/playlists', methods=['GET'])
@jwt_required()
def get_playlists():
    user_id = get_jwt_identity()
    user_p = Playlist.query.filter_by(user_id=user_id).all()
    sys_p = Playlist.query.filter_by(is_system=True).all()
    output = []
    for p in sys_p: output.append({'id': p.id, 'name': p.name, 'is_system': True})
    for p in user_p: output.append({'id': p.id, 'name': p.name, 'is_system': False})
    return jsonify(output)

@app.route('/api/playlists/<int:playlist_id>', methods=['GET'])
@jwt_required()
def get_playlist_details(playlist_id):
    user_id = get_jwt_identity()
    playlist = Playlist.query.get(playlist_id)
    if not playlist: return jsonify({"message": "Not found"}), 404
    if not playlist.is_system and str(playlist.user_id) != str(user_id): return jsonify({"message": "Access denied"}), 403
    song_ids = [ps.song_id for ps in PlaylistSong.query.filter_by(playlist_id=playlist_id).all()]
    songs = Song.query.filter(Song.id.in_(song_ids)).all()
    return jsonify({
        "id": playlist.id, "name": playlist.name, "is_system": playlist.is_system,
        "songs": [{'id': s.id, 'title': s.title, 'artist': s.artist, 'src': s.src, 'cover': s.cover} for s in songs]
    })

@app.route('/api/playlists', methods=['POST'])
@jwt_required()
def create_playlist():
    user_id = get_jwt_identity()
    new_p = Playlist(name=request.get_json().get('name'), user_id=user_id)
    db.session.add(new_p); db.session.commit()
    return jsonify({'id': new_p.id, 'name': new_p.name}), 201

@app.route('/api/playlists/add_song', methods=['POST'])
@jwt_required()
def add_song():
    user_id = get_jwt_identity()
    data = request.get_json()
    pid, sid = data.get('playlist_id'), data.get('song_id')
    if not Playlist.query.filter_by(id=pid, user_id=user_id).first(): return jsonify({"message": "Error"}), 404
    if not PlaylistSong.query.filter_by(playlist_id=pid, song_id=sid).first():
        db.session.add(PlaylistSong(playlist_id=pid, song_id=sid)); db.session.commit()
    return jsonify({"message": "Added"}), 200

@app.route('/api/likes', methods=['GET'])
@jwt_required()
def get_likes():
    return jsonify([l.song_id for l in LikedSong.query.filter_by(user_id=get_jwt_identity()).all()])

@app.route('/api/likes', methods=['POST'])
@jwt_required()
def toggle_like():
    user_id = get_jwt_identity(); sid = request.get_json().get('song_id')
    existing = LikedSong.query.filter_by(user_id=user_id, song_id=sid).first()
    if existing: db.session.delete(existing); db.session.commit(); return jsonify({"status": "removed"})
    db.session.add(LikedSong(user_id=user_id, song_id=sid)); db.session.commit(); return jsonify({"status": "added"})

@app.route('/api/signup', methods=['POST'])
@limiter.limit("5 per minute") # <--- ADD LIMIT
def signup():
    data = request.get_json()
    
    # Pre-check (Fast)
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Email already registered"}), 400
        
    hashed = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(name=data['name'], email=data['email'], password=hashed)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User created successfully"}), 201
    except IntegrityError:
        db.session.rollback() # Undo the stuck transaction
        return jsonify({"message": "Email already registered"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Signup Error: {e}")
        return jsonify({"message": "Error creating account"}), 500

# --- UPLOAD ROUTE (FIXED) ---
@app.route('/api/upload_avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if 'image' not in request.files:
        return jsonify({"message": "No image part"}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
        
    if file:
        # Ensure directory exists
        profiles_dir = os.path.join(ASSETS_DIR, 'profiles')
        if not os.path.exists(profiles_dir):
            os.makedirs(profiles_dir)
            
        # Create secure filename
        from werkzeug.utils import secure_filename
        # Use timestamp to avoid caching issues
        filename = secure_filename(f"user_{user_id}_{int(time.time())}.jpg")
        
        # Save File
        save_path = os.path.join(profiles_dir, filename)
        file.save(save_path)
        
        # Save Web Path to DB
        web_path = f"/assets/profiles/{filename}"
        user.profile_pic = web_path
        db.session.commit()
        
        return jsonify({"message": "Uploaded", "url": web_path}), 200

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute") # <--- ADD LIMIT
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        token = create_access_token(identity=str(user.id))
        return jsonify({
            "token": token, 
            "user": {
                "id": user.id, 
                "name": user.name, 
                "email": user.email,
                "profile_pic": user.profile_pic # <-- Return this
            }
        }), 200
    return jsonify({"message": "Invalid"}), 401

# --- MOVE DATABASE INITIALIZATION HERE (AT THE BOTTOM) ---
with app.app_context():
    # 1. Create Tables
    db.create_all()
    print(">>> Database initialized successfully!")

    # 2. Create Folders (Safety Check)
    folders = [
        os.path.join(app.root_path, 'rhymic-react', 'public', 'assets', 'music'),
        os.path.join(app.root_path, 'rhymic-react', 'public', 'assets', 'covers'),
        os.path.join(app.root_path, 'rhymic-react', 'public', 'assets', 'profiles'),
        os.path.join(app.root_path, 'rhymic-react', 'public', 'assets', 'music', 'Uploads')
    ]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)


# --- RUNNER ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        scan_library()      
        # RE-ENABLED: Fix 5 songs every time server starts
        auto_fix_metadata(limit=5) 

    # DISABLED BACKGROUND WORKER (To prevent deadlocks)
    # if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    #    worker_thread = threading.Thread(target=background_worker, daemon=True)
    #    worker_thread.start()

    app.run(debug=True, port=5000)