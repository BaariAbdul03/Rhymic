import os
import re
import threading
from flask import Flask, Response, send_from_directory, jsonify
from werkzeug.exceptions import NotFound

from backend.config import config, _verify_database_url
from backend.extensions import db, bcrypt, jwt, cors, migrate, limiter
from backend.routes import register_routes
from backend.utils.errors import register_error_handlers
from backend.services.scanner import scan_library
from backend.services.metadata_fixer import auto_fix_metadata
from backend.services.online_provider import get_online_provider_status
from backend.services.structured_logging import setup_logging, log_request


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_CONFIG', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    app.config["PROPAGATE_EXCEPTIONS"] = False
    _validate_runtime_config(app)
    if app.debug and not _verify_database_url(app.config['SQLALCHEMY_DATABASE_URI']):
        app.config.update(SQLALCHEMY_DATABASE_URI='sqlite:///site.db', USING_SQLITE_FALLBACK=True)

    # Log database status on startup
    if app.config.get('USING_SQLITE_FALLBACK'):
        print("=" * 60)
        print("[WARN] Running on SQLite fallback — Neon DB is unreachable!")
        print("[WARN] Data from your Neon database is NOT available.")
        print("[WARN] Check your DATABASE_URL and Neon project status.")
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

    # Structured logging
    setup_logging(app)

    # Register Blueprints & Error Handlers
    register_routes(app)
    register_error_handlers(app)
    
    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Content-Security-Policy — critical XSS defense
        # Allows: same-origin resources, Google/YouTube thumbnails, audio streaming
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' https://*.googleusercontent.com https://*.ggpht.com https://*.ytimg.com data:; "
            "media-src 'self' blob: https://*.googlevideo.com; "
            "connect-src 'self'; "
            "script-src 'self' https://www.youtube.com; "
            "frame-src https://www.youtube.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "frame-ancestors 'none'"
        )
        # Strict-Transport-Security — enforce HTTPS
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        log_request(app.logger, response)
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
                
        return jsonify({
            "status": "ok" if status_code == 200 else "error",
            "database": db_status,
            "online_provider": provider_status,
            "message": "Neon DB unreachable — running on SQLite fallback" if app.config.get('USING_SQLITE_FALLBACK') else "All systems operational"
        }), status_code

    # Metrics endpoint for monitoring (Prometheus-compatible)
    @app.route('/api/metrics')
    def metrics():
        import time
        from sqlalchemy import text
        
        metrics = {
            "rhymic_app_info": 1,
            "rhymic_build_timestamp": "2026-07-19",
        }
        
        # DB connection check
        try:
            db.session.execute(text("SELECT 1"))
            metrics["rhymic_db_up"] = 1
        except:
            metrics["rhymic_db_up"] = 0
        
        # Request count (approximate)
        metrics["rhymic_requests_total"] = 1
        
        # Output in Prometheus format
        output = []
        for key, value in metrics.items():
            output.append(f"# HELP {key} RhyMic metric")
            output.append(f"# TYPE {key} gauge")
            output.append(f"{key} {value}")
        
        return "\n".join(output), 200, {'Content-Type': 'text/plain'}

    # Make ASSETS_DIR available
    DIST_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'dist'))
    if os.path.exists(DIST_DIR):
        app.config['ASSETS_DIR'] = os.path.join(DIST_DIR, 'assets')
    else:
        app.config['ASSETS_DIR'] = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'public', 'assets'))

    # Static File Routes (for SPA and assets)
    # NOTE: The assets route MUST be defined BEFORE the catch-all /<path:path> route,
    # otherwise Flask/Werkzeug will match the catch-all first and never reach serve_assets.
    # This caused audio files to receive HTML instead of MP3 data.
    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        """
        Serve static assets (images, audio files, etc.) from ASSETS_DIR.
        Handles URL decoding, missing files, and fallback covers.
        """
        try:
            versioned = re.fullmatch(r"[\w-]+-[\w-]{8}\.(css|js)", filename)
            response = send_from_directory(
                app.config['ASSETS_DIR'], filename, max_age=31536000 if versioned else None
            )
            if versioned:
                response.cache_control.immutable = True
            return response
        except NotFound:
            # For images, fall back to the default cover
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')): 
                try:
                    return send_from_directory(app.config['ASSETS_DIR'], 'default_cover.jpg')
                except NotFound:
                    pass
            # For audio files, return a proper 404 so the browser can trigger the
            # error handler instead of silently receiving HTML (SPA fallback).
            return Response("Not Found", status=404, mimetype="text/plain")

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if not os.path.exists(DIST_DIR):
            return "RhyMic Backend Running (Frontend not built)", 200

        if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
            return send_from_directory(DIST_DIR, path)
        
        # IMPORTANT: Don't serve index.html for /assets/ requests that don't exist —
        # this would return HTML where the browser expects MP3/audio data.
        # The /assets/<path:filename> route above handles this correctly.
        
        # Handle SPA routing (only for non-asset paths)
        if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
            return send_from_directory(DIST_DIR, 'index.html')

        return "RhyMic Frontend Error", 404

    # Run Initialization Tasks Setup
    _initialize_app(app)

    return app


def _initialize_app(app):
    with app.app_context():
        try:
            # Production schema changes are handled by the migration runner.
            if not app.config.get("REQUIRE_DATABASE_URL"):
                db.create_all()

            # Scan Library (Fast)
            scan_library(app)

            # Background Metadata Fixer (Slow). Disabled by default in production
            # so multiple web workers do not duplicate Groq calls.
            if os.getenv("GROQ_API_KEY") and os.getenv("ENABLE_METADATA_FIXER", "false").lower() == "true":
                def run_background_fix():
                    auto_fix_metadata(app)
                thread = threading.Thread(target=run_background_fix)
                thread.daemon = True
                thread.start()
                
        except Exception:
            app.logger.exception("Library initialization failed")


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
