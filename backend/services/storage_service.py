"""
Neon-backed file storage — replaces Supabase Storage.

Neon is plain PostgreSQL (no object storage API in the free tier we target),
so small assets (profile pictures, song cover thumbnails) are persisted as
bytea rows in the `stored_file` table and served by the /api/files/<id>
route. Content-hash keys make uploads idempotent and deduplicated.

If the database write fails (e.g. SQLite dev fallback without the table),
callers fall back to local-disk behavior exactly like before.
"""

import hashlib
import os

from backend.extensions import db
from backend.models.stored_file import StoredFile

# URL prefix under which StoredFile rows are served by routes/files.py
FILES_URL_PREFIX = "/api/files"


def save_file(file_bytes, mime_type="image/jpeg"):
    """
    Store bytes under their sha256 content hash (idempotent).
    Returns the public serving URL, or None on failure.
    """
    if not file_bytes or len(file_bytes) == 0:
        return None
    if len(file_bytes) > StoredFile.MAX_SIZE:
        print(f"[Storage] File too large for DB storage: {len(file_bytes)} bytes")
        return None

    file_id = hashlib.sha256(file_bytes).hexdigest()

    try:
        existing = db.session.get(StoredFile, file_id)
        if existing:
            # Already stored — touch nothing, return the stable URL
            return f"{FILES_URL_PREFIX}/{file_id}"

        row = StoredFile(
            id=file_id,
            mime_type=(mime_type or "image/jpeg").split(";")[0][:100],
            size=len(file_bytes),
            data=file_bytes,
        )
        db.session.add(row)
        db.session.commit()
        return f"{FILES_URL_PREFIX}/{file_id}"
    except Exception as e:
        db.session.rollback()
        print(f"[Storage] DB save failed: {e}")
        return None


def load_file(file_id):
    """
    Fetch stored bytes. Returns (data, mime_type) or None.
    """
    if not file_id or len(file_id) != 64 or not all(c in "0123456789abcdef" for c in file_id.lower()):
        return None
    try:
        row = db.session.get(StoredFile, file_id.lower())
        if row and row.data:
            return bytes(row.data), row.mime_type
    except Exception as e:
        print(f"[Storage] DB load failed: {e}")
    return None


def get_file_size(file_id):
    """Return stored size in bytes without loading the blob, or None."""
    if not file_id or len(file_id) != 64:
        return None
    try:
        row = db.session.get(StoredFile, file_id.lower())
        return row.size if row else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Backwards-compatible helpers used by routes/auth.py and routes/stream.py
# ---------------------------------------------------------------------------

_EXT_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def upload_profile_pic(file_bytes, filename):
    """
    Store a profile picture in Neon. Returns the serving URL, or None so the
    caller can fall back to saving on local disk (dev mode behavior).
    """
    ext = os.path.splitext(filename or "")[1].lower() or ".jpg"
    mime = _EXT_MIME.get(ext, "image/jpeg")
    return save_file(file_bytes, mime)


def upload_thumbnail(file_bytes, file_hash, mime_type="image/jpeg"):
    """
    Persistent cache for song cover thumbnails, keyed by an externally
    supplied hash (cache key of the source URL). Returns the URL or None.
    """
    if not file_bytes or not file_hash or len(file_bytes) > StoredFile.MAX_SIZE:
        return None

    key = file_hash.lower()
    if not all(c in "0123456789abcdef" for c in key):
        return None

    try:
        existing = db.session.get(StoredFile, key)
        if not existing:
            db.session.add(StoredFile(
                id=key,
                mime_type=(mime_type or "image/jpeg").split(";")[0][:100],
                size=len(file_bytes),
                data=file_bytes,
            ))
            db.session.commit()
        return f"{FILES_URL_PREFIX}/{key}"
    except Exception as e:
        db.session.rollback()
        print(f"[Storage] Thumbnail save failed: {e}")
        return None


def get_cached_thumbnail_url(file_hash):
    """
    Returns the local serving URL if this thumbnail hash exists in the DB,
    else None. Unlike the old Supabase version, this actually checks
    existence, so callers can rely on the answer.
    """
    if not file_hash or len(file_hash) != 64:
        return None
    try:
        row = db.session.get(StoredFile, file_hash.lower())
        if row:
            return f"{FILES_URL_PREFIX}/{file_hash.lower()}"
    except Exception:
        pass
    return None
