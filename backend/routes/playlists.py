from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.models.playlist import Playlist, PlaylistSong
from backend.models.song import Song
from sqlalchemy.orm import joinedload

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
    
    # Optimize query using joinedload to fetch playlist, its song links, and the song data in one go
    playlist = Playlist.query.options(
        joinedload(Playlist.songs).joinedload(PlaylistSong.song)
    ).filter_by(id=playlist_id).first()
    
    if not playlist: 
        return jsonify({"message": "Playlist not found"}), 404
        
    if not playlist.is_system and str(playlist.user_id) != str(user_id): 
        return jsonify({"message": "Access denied"}), 403
        
    # Extract songs from the pre-loaded relationship
    songs = [ps.song for ps in playlist.songs if ps.song]
    
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

@playlists_bp.route('/<int:playlist_id>', methods=['DELETE'])
@jwt_required()
def delete_playlist(playlist_id):
    user_id = get_jwt_identity()
    playlist = Playlist.query.get(playlist_id)
    
    if not playlist:
        return jsonify({"message": "Playlist not found"}), 404
    if str(playlist.user_id) != str(user_id) or playlist.is_system:
        return jsonify({"message": "Access denied"}), 403
        
    try:
        PlaylistSong.query.filter_by(playlist_id=playlist_id).delete()
        db.session.delete(playlist)
        db.session.commit()
        return jsonify({"message": "Playlist deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete playlist"}), 500

@playlists_bp.route('/<int:playlist_id>', methods=['PATCH'])
@jwt_required()
def rename_playlist(playlist_id):
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"message": "Playlist name is required"}), 400
        
    user_id = get_jwt_identity()
    playlist = Playlist.query.get(playlist_id)
    
    if not playlist:
        return jsonify({"message": "Playlist not found"}), 404
    if str(playlist.user_id) != str(user_id) or playlist.is_system:
        return jsonify({"message": "Access denied"}), 403
        
    try:
        playlist.name = data.get('name')
        db.session.commit()
        return jsonify({"message": "Playlist renamed"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to rename playlist"}), 500

@playlists_bp.route('/add_song', methods=['POST'])
@jwt_required()
def add_song():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'playlist_id' not in data or ('song_id' not in data and 'song' not in data):
        return jsonify({"message": "Missing playlist_id or song/song_id"}), 400
        
    pid = data.get('playlist_id')
    if 'song' in data and data['song'].get('source') == 'online':
        sid = Song.ensure_online_song(data['song'])
    else:
        sid = data.get('song_id') or data.get('song', {}).get('id')
    
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
