from datetime import datetime, timezone
from backend.extensions import db


class StoredFile(db.Model):
    """
    Neon-backed file storage (replaces Supabase Storage).

    Small binary assets (profile pictures, cached song covers) are stored
    as bytea rows keyed by a content hash, and served via /api/files/<id>.
    Content-hash keys make writes idempotent: uploading the same image
    twice does not duplicate storage.
    """
    __tablename__ = "stored_file"

    id = db.Column(db.String(64), primary_key=True)  # sha256 hex digest
    mime_type = db.Column(db.String(100), nullable=False, default="image/jpeg")
    size = db.Column(db.Integer, nullable=False, default=0)
    data = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    MAX_SIZE = 2 * 1024 * 1024  # 2MB per stored asset

    def to_dict(self):
        return {
            "id": self.id,
            "mime_type": self.mime_type,
            "size": self.size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
