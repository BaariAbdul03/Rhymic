import os
import uuid
from supabase import create_client

BUCKET_NAME = "profile-pics"
COVER_BUCKET = "song-covers"

def upload_profile_pic(file_bytes, filename):
    """Upload to Supabase Storage. Falls back to local disk in dev."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        # Dev fallback — save locally
        return None  # Caller handles local save

    client = create_client(supabase_url, supabase_key)
    ext = os.path.splitext(filename)[1] or ".jpg"
    remote_path = f"users/{uuid.uuid4().hex}{ext}"

    # file_bytes is the raw content of the file
    res = client.storage.from_(BUCKET_NAME).upload(
        remote_path, file_bytes,
        file_options={"content-type": f"image/{ext.lstrip('.')}"}
    )

    public_url = client.storage.from_(BUCKET_NAME).get_public_url(remote_path)
    return public_url

def upload_thumbnail(file_bytes, file_hash, mime_type="image/jpeg"):
    """Persistent cloud cache for thumbnails."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        return None

    try:
        client = create_client(supabase_url, supabase_key)
        # Check if already exists to save quota
        try:
            public_url = client.storage.from_(COVER_BUCKET).get_public_url(file_hash)
            # Check if it actually exists by making a HEAD request or just try upload
            # Simplest: Just try upload and catch 409 Conflict if Supabase supports it, 
            # but usually it's better to just upload with upsert=true
            res = client.storage.from_(COVER_BUCKET).upload(
                file_hash, file_bytes,
                file_options={"content-type": mime_type, "upsert": "true"}
            )
            return client.storage.from_(COVER_BUCKET).get_public_url(file_hash)
        except Exception:
            return None
    except Exception as e:
        print(f"[Supabase Storage] Error: {e}")
        return None

def get_cached_thumbnail_url(file_hash):
    """Checks if a thumbnail is already in Supabase."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        return None

    try:
        # Supabase get_public_url doesn't check if file exists, it just returns the string.
        # So we have to decide if we want to trust it or do a proper existence check.
        # For performance, we'll return it and let the frontend/proxy fallback if 404.
        return f"{supabase_url}/storage/v1/object/public/{COVER_BUCKET}/{file_hash}"
    except Exception:
        return None
