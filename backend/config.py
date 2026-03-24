import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Use fallback only in development
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-do-not-use-in-prod')
    
    # DB Config
    database_url = os.environ.get('DATABASE_URL')
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = database_url or 'sqlite:///site.db'
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

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # Ensure strong secret key in production
    
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
