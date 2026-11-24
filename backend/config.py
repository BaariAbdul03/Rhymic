import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url):
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    # SQLAlchemy >= 2.1 defaults to the psycopg3 dialect for plain
    # postgresql:// URLs, which is NOT in our requirements. Pin the
    # dialect to psycopg2 (psycopg2-binary) explicitly so the driver
    # never changes under us.
    if url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _verify_database_url(url, allow_fallback=True):
    """
    Test if the configured database URL is reachable.
    Returns the URL if healthy, or None if the database is unreachable
    (e.g. Neon compute suspended and not yet awake, or a bad URL).
    """
    if not url or url.startswith('sqlite'):
        return url  # SQLite is always local, no check needed

    engine = None
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(url, connect_args={"connect_timeout": 5}, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[DB] PostgreSQL connection verified successfully.")
        return url
    except Exception as e:
        print(f"[DB] PostgreSQL unreachable ({type(e).__name__}).")
        if not allow_fallback:
            raise RuntimeError("Configured DATABASE_URL is unreachable in production.") from e
        print("[DB] Falling back to local SQLite database.")
        return None
    finally:
        if engine is not None:
            engine.dispose()


class Config:
    # Use fallback only in development
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-do-not-use-in-prod')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-do-not-use-in-prod')
    
    # Rate Limiting Storage
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    
    # DB Config — with automatic fallback if PostgreSQL is unreachable
    _raw_database_url = _normalize_database_url(os.environ.get('DATABASE_URL'))

    SQLALCHEMY_DATABASE_URI = _raw_database_url or 'sqlite:///site.db'
    USING_SQLITE_FALLBACK = False

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Neon: pool_pre_ping recycles dead connections after compute auto-suspend,
    # pool_recycle=300 matches Neon's idle connection timeout.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # JWT Config
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    
    # Upload limits
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024 # 5MB Limit for Uploads
    
    # Allowed CORS Origins — explicit allowlist (never wildcard)
    _allowed = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5000')
    ALLOWED_ORIGINS = _allowed.split(',')

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
