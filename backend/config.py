import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url):
    if url and url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def _verify_database_url(url, allow_fallback=True):
    """
    Test if the configured database URL is reachable.
    Returns the URL if healthy, or None if the database is unreachable
    (e.g. Supabase free-tier paused after inactivity).
    """
    if not url or url.startswith('sqlite'):
        return url  # SQLite is always local, no check needed

    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(url, connect_args={"connect_timeout": 5}, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        print("[DB] PostgreSQL connection verified successfully.")
        return url
    except Exception as e:
        print(f"[DB] WARNING: PostgreSQL unreachable ({type(e).__name__}: {e})")
        if not allow_fallback:
            raise RuntimeError("Configured DATABASE_URL is unreachable in production.") from e
        print("[DB] Falling back to local SQLite database.")
        return None


class Config:
    # Use fallback only in development
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-do-not-use-in-prod')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-do-not-use-in-prod')
    
    # DB Config — with automatic fallback if PostgreSQL is unreachable
    _raw_database_url = _normalize_database_url(os.environ.get('DATABASE_URL'))

    _verified_url = _verify_database_url(_raw_database_url)
    SQLALCHEMY_DATABASE_URI = _verified_url or 'sqlite:///site.db'
    USING_SQLITE_FALLBACK = _verified_url is None and _raw_database_url is not None

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # JWT Config
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    
    # Upload limits
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024 # 5MB Limit for Uploads
    
    # Allowed CORS Origins
    ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*').split(',')

    # Supabase (Storage & General API)
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')

    _raw_database_url = _normalize_database_url(os.environ.get('DATABASE_URL'))
    SQLALCHEMY_DATABASE_URI = _raw_database_url
    USING_SQLITE_FALLBACK = False
    REQUIRE_DATABASE_URL = True
    REQUIRE_STRONG_SECRETS = True
    
class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'test': TestConfig,
    'default': DevelopmentConfig
}
