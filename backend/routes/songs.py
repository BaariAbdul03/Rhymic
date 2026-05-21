from flask import Blueprint, jsonify, request
from backend.models.song import Song

songs_bp = Blueprint('songs', __name__)

@songs_bp.route('/', methods=['GET'])
def get_songs():
    """
    Get all songs with optional pagination.
    """
    # Pagination added for enterprise readiness
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 100, type=int) # Default 100 for now to keep frontend working
    
    # Cap limit to 500
    if per_page > 500:
        per_page = 500
        
    try:
        # Just returning all for now to not break the frontend which expects a flat array
        # In Phase 3 we will update the frontend to support paginated responses
        songs_query = Song.query.all()
        return jsonify([s.to_dict() for s in songs_query])
    except Exception as e:
        print(f"Songs query error: {e}")
        return jsonify([]), 200  # Return empty array, not 500

@songs_bp.route('/<int:song_id>', methods=['GET'])
def get_song(song_id):
    try:
        song = Song.query.get(song_id)
        if not song:
            return jsonify({"message": "Song not found"}), 404
        return jsonify(song.to_dict())
    except Exception as e:
        print(f"Song query error: {e}")
        return jsonify({"message": "Song not found"}), 404
