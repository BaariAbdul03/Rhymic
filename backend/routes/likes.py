from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.models.playlist import LikedSong

likes_bp = Blueprint('likes', __name__)

@likes_bp.route('/', methods=['GET'])
@jwt_required()
def get_likes():
    """Get all liked song IDs for the current user."""
    from backend.models.song import Song
    user_id = get_jwt_identity()
    
    # Joining with Song to get the mapped ID (youtube_id for online, id for local)
    likes_data = db.session.query(Song).join(LikedSong, LikedSong.song_id == Song.id).filter(LikedSong.user_id == user_id).order_by(LikedSong.id.desc()).all()
    
    return jsonify([s.youtube_id if s.source == 'online' else s.id for s in likes_data])

@likes_bp.route('/', methods=['POST'])
@jwt_required()
def toggle_like():
    """Toggle a like for a specific song."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or ('song_id' not in data and 'song' not in data):
        return jsonify({"message": "Missing song or song_id"}), 400
        
    if 'song' in data and data['song'].get('source') == 'online':
        from backend.models.song import Song
        sid = Song.ensure_online_song(data['song'])
    else:
        sid = data.get('song_id') or data.get('song', {}).get('id')
        
    existing = LikedSong.query.filter_by(user_id=user_id, song_id=sid).first()
    
    try:
        if existing: 
            db.session.delete(existing)
            db.session.commit()
            return jsonify({"status": "removed"})
            
        new_like = LikedSong(user_id=user_id, song_id=sid)
        db.session.add(new_like)
        db.session.commit()
        return jsonify({"status": "added"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to toggle like"}), 500
