import os
import threading
from flask import Flask, send_from_directory, jsonify
from urllib.parse import unquote

from backend.config import config, _verify_database_url
from backend.extensions import db, bcrypt, jwt, cors, migrate, limiter
from backend.routes import register_routes
from backend.utils.errors import register_error_handlers
from backend.services.scanner import scan_library
from backend.services.metadata_fixer import auto_fix_metadata
from backend.services.online_provider import get_online_provider_status

def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_CONFIG', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    app.config["PROPAGATE_EXCEPTIONS"] = False
    _validate_runtime_config(app)

    # Log database status on startup
    if app.config.get('USING_SQLITE_FALLBACK'):
        print("=" * 60)
        print("[WARN] Running on SQLite fallback — Supabase DB is paused!")
        print("[WARN] Data from your Supabase database is NOT available.")
        print("[WARN] Unpause at: https://supabase.com/dashboard")
        print("=" * 60)

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
    
    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Health check endpoint for Render and monitoring
    @app.route('/api/health')
    def health_check():
        try:
            from sqlalchemy import text
            db.session.execute(text("SELECT 1"))
            db_status = "sqlite_fallback" if app.config.get('USING_SQLITE_FALLBACK') else "connected"
            status_code = 200
        except Exception:
            db_status = "disconnected"
            status_code = 503
            
        provider_status = get_online_provider_status()
        if provider_status.get("resolver_url"):
            try:
                import requests
                resp = requests.get(f"{provider_status['resolver_url']}/health", timeout=3)
                provider_status["resolver_responsive"] = resp.status_code == 200
            except Exception:
                provider_status["resolver_responsive"] = False
                
            if not provider_status.get("resolver_responsive"):
                status_code = 503

        return jsonify({
            "status": "ok" if status_code == 200 else "error",
            "database": db_status,
            "online_provider": provider_status,
            "message": "Supabase DB is paused — running on SQLite fallback" if app.config.get('USING_SQLITE_FALLBACK') else "All systems operational"
        }), status_code

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
            return "RhyMic Backend Running (Frontend not built)", 200

        if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
            return send_from_directory(DIST_DIR, path)
        
        # Handle SPA routing
        if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
            return send_from_directory(DIST_DIR, 'index.html')

        return "RhyMic Frontend Error", 404

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
            if app.config.get("DEBUG") or app.config.get("TESTING") or app.config.get("USING_SQLITE_FALLBACK"):
                db.create_all()

            # MIGRATION: Attempt to add/update profile_pic column safely
            # Only run on PostgreSQL (not SQLite fallback)
            if not app.config.get('USING_SQLITE_FALLBACK') and not app.config.get("REQUIRE_DATABASE_URL"):
                try:
                    with db.engine.connect() as conn:
                        from sqlalchemy import text
                        try:
                            conn.execute(text('ALTER TABLE "user" ADD COLUMN profile_pic TEXT'))
                            conn.commit()
                            print("Migrated: Added profile_pic column")
                        except Exception:
                            conn.rollback() 
                            try:
                                conn.execute(text('ALTER TABLE "user" ALTER COLUMN profile_pic TYPE TEXT'))
                                conn.commit()
                                print("Migrated: Updated profile_pic to TEXT")
                            except Exception:
                                conn.rollback()
                except Exception as e:
                    pass # Expected if already migrated

            # Scan Library (Fast)
            scan_library(app)

            # Background Metadata Fixer (Slow). Disabled by default in production
            # so multiple web workers do not duplicate Gemini calls.
            if os.getenv("GOOGLE_API_KEY") and os.getenv("ENABLE_METADATA_FIXER", "false").lower() == "true":
                def run_background_fix():
                    auto_fix_metadata(app)
                thread = threading.Thread(target=run_background_fix)
                thread.daemon = True
                thread.start()
                
        except Exception as e:
            print(f"Initialization Error: {e}")


def _validate_runtime_config(app):
    if app.config.get("REQUIRE_DATABASE_URL") and not app.config.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError("DATABASE_URL must be set in production.")
    if app.config.get("REQUIRE_DATABASE_URL"):
        _verify_database_url(app.config.get("SQLALCHEMY_DATABASE_URI"), allow_fallback=False)

    if app.config.get("REQUIRE_STRONG_SECRETS"):
        secret_key = app.config.get("SECRET_KEY")
        jwt_secret = app.config.get("JWT_SECRET_KEY")
        if not secret_key or "dev-" in secret_key:
            raise RuntimeError("SECRET_KEY or JWT_SECRET_KEY must be set in production.")
        if not jwt_secret or "dev-" in jwt_secret:
            raise RuntimeError("JWT_SECRET_KEY must be set in production.")
