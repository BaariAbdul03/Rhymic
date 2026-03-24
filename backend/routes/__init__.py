from .auth import auth_bp
from .songs import songs_bp
from .playlists import playlists_bp
from .likes import likes_bp
from .ai import ai_bp

def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(songs_bp, url_prefix='/api/songs')
    app.register_blueprint(playlists_bp, url_prefix='/api/playlists')
    app.register_blueprint(likes_bp, url_prefix='/api/likes')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
