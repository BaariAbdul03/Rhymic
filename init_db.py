from app import app
from backend.extensions import db
from backend.services.scanner import scan_library

print("Initializing Database...")
with app.app_context():
    db.create_all()
    print("Database tables created successfully!")
    
    print("Scanning Library...")
    scan_library(app)
    print("Library scan complete!")
