from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.models.playlist import Playlist, PlaylistSong
from backend.models.song import Song

playlists_bp = Blueprint('playlists', __name__)

@playlists_bp.route('/', methods=['GET'])
@jwt_required()
def get_playlists():
    user_id = get_jwt_identity()
    user_p = Playlist.query.filter_by(user_id=user_id).all()
    sys_p = Playlist.query.filter_by(is_system=True).all()
    
    output = []
    for p in sys_p: 
        output.append({'id': p.id, 'name': p.name, 'is_system': True})
    for p in user_p: 
        output.append({'id': p.id, 'name': p.name, 'is_system': False})
        
    return jsonify(output)

@playlists_bp.route('/<int:playlist_id>', methods=['GET'])
@jwt_required()
def get_playlist_details(playlist_id):
    user_id = get_jwt_identity()
    playlist = Playlist.query.get(playlist_id)
    
    if not playlist: 
        return jsonify({"message": "Playlist not found"}), 404
        
    if not playlist.is_system and str(playlist.user_id) != str(user_id): 
        return jsonify({"message": "Access denied"}), 403
        
    song_ids = [ps.song_id for ps in PlaylistSong.query.filter_by(playlist_id=playlist_id).all()]
    songs = Song.query.filter(Song.id.in_(song_ids)).all()
    
    return jsonify({
        "id": playlist.id, "name": playlist.name, "is_system": playlist.is_system,
        "songs": [s.to_dict() for s in songs]
    })

@playlists_bp.route('/', methods=['POST'])
@jwt_required()
def create_playlist():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"message": "Playlist name is required"}), 400
        
    user_id = get_jwt_identity()
    new_p = Playlist(name=data.get('name'), user_id=user_id)
    
    try:
        db.session.add(new_p)
        db.session.commit()
        return jsonify({'id': new_p.id, 'name': new_p.name}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create playlist"}), 500

@playlists_bp.route('/add_song', methods=['POST'])
@jwt_required()
def add_song():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'playlist_id' not in data or 'song_id' not in data:
        return jsonify({"message": "Missing playlist_id or song_id"}), 400
        
    pid, sid = data.get('playlist_id'), data.get('song_id')
    
    # Verify playlist belongs to user
    playlist = Playlist.query.filter_by(id=pid, user_id=user_id).first()
    if not playlist: 
        return jsonify({"message": "Playlist not found or access denied"}), 404
        
    # Check if song already in playlist
    if not PlaylistSong.query.filter_by(playlist_id=pid, song_id=sid).first():
        new_link = PlaylistSong(playlist_id=pid, song_id=sid)
        db.session.add(new_link)
        db.session.commit()
        
    return jsonify({"message": "Added to playlist"}), 200
