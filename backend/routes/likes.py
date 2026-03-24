from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.models.playlist import LikedSong

likes_bp = Blueprint('likes', __name__)

@likes_bp.route('/', methods=['GET'])
@jwt_required()
def get_likes():
    """Get all liked song IDs for the current user."""
    user_id = get_jwt_identity()
    likes = LikedSong.query.filter_by(user_id=user_id).all()
    return jsonify([l.song_id for l in likes])

@likes_bp.route('/', methods=['POST'])
@jwt_required()
def toggle_like():
    """Toggle a like for a specific song."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'song_id' not in data:
        return jsonify({"message": "Missing song_id"}), 400
        
    sid = data.get('song_id')
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
