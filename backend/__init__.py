import os
import threading
from flask import Flask, send_from_directory
from urllib.parse import unquote

from backend.config import config
from backend.extensions import db, bcrypt, jwt, cors, migrate, limiter
from backend.routes import register_routes
from backend.utils.errors import register_error_handlers
from backend.services.scanner import scan_library
from backend.services.metadata_fixer import auto_fix_metadata

def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_CONFIG', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    
    # Configure CORS using whitelist
    allowed_origins = app.config.get('ALLOWED_ORIGINS', ['*'])
    cors.init_app(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)
    
    migrate.init_app(app, db)
    limiter.init_app(app)

    # Register Blueprints & Error Handlers
    register_routes(app)
    register_error_handlers(app)

    # Make ASSETS_DIR available
    DIST_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'dist'))
    if os.path.exists(DIST_DIR):
        app.config['ASSETS_DIR'] = os.path.join(DIST_DIR, 'assets')
    else:
        app.config['ASSETS_DIR'] = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'public', 'assets'))

    # Static File Routes (for SPA and assets)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if not os.path.exists(DIST_DIR):
            return "Rhymic Backend Running (Frontend not built)", 200

        if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
            return send_from_directory(DIST_DIR, path)
        
        # Handle SPA routing
        if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
            return send_from_directory(DIST_DIR, 'index.html')

        return "Rhymic Frontend Error", 404

    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        try:
            return send_from_directory(app.config['ASSETS_DIR'], unquote(filename))
        except: 
            if filename.endswith(('.jpg', '.png')): 
                return send_from_directory(app.config['ASSETS_DIR'], 'default_cover.jpg')
            return "Not Found", 404

    # Run Initialization Tasks Setup
    _initialize_app(app)

    return app


def _initialize_app(app):
    with app.app_context():
        try:
            # Note: with migrate, we might not want to db.create_all() unconditionally
            # but we'll leave it for backward compatibility before migrations run
            db.create_all()

            # MIGRATION: Attempt to add/update profile_pic column safely
            try:
                with db.engine.connect() as conn:
                    from sqlalchemy import text
                    try:
                        conn.execute(text('ALTER TABLE "user" ADD COLUMN profile_pic TEXT'))
                        conn.commit()
                        print("Migrated: Added profile_pic column")
                    except Exception:
                        conn.rollback() 
                        conn.execute(text('ALTER TABLE "user" ALTER COLUMN profile_pic TYPE TEXT'))
                        conn.commit()
                        print("Migrated: Updated profile_pic to TEXT")
            except Exception as e:
                pass # Expected if using non-postgres or already migrated

            # Scan Library (Fast)
            scan_library(app)

            # Background Metadata Fixer (Slow)
            if os.getenv("GOOGLE_API_KEY"):
                def run_background_fix():
                    auto_fix_metadata(app)
                thread = threading.Thread(target=run_background_fix)
                thread.daemon = True
                thread.start()
                
        except Exception as e:
            print(f"Initialization Error: {e}")
