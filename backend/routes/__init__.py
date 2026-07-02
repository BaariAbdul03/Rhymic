from .auth import auth_bp
from .songs import songs_bp
from .playlists import playlists_bp
from .likes import likes_bp
from .ai import ai_bp
from .artists import artists_bp
from .mood import mood_bp
from .stream import stream_bp

def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(songs_bp, url_prefix='/api/songs')
    app.register_blueprint(playlists_bp, url_prefix='/api/playlists')
    app.register_blueprint(likes_bp, url_prefix='/api/likes')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(artists_bp, url_prefix='/api/artists')
    app.register_blueprint(mood_bp, url_prefix='/api/mood')
    app.register_blueprint(stream_bp, url_prefix='/api/stream')
