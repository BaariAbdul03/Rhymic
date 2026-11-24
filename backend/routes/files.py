from flask import Blueprint, Response, send_from_directory, current_app
import os

from backend.services.storage_service import load_file

files_bp = Blueprint('files', __name__)

_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=604800, immutable",
}


@files_bp.route('/<file_id>', methods=['GET'])
def serve_file(file_id):
    """
    Serve a stored asset (profile pictures, cached covers) from the Neon
    `stored_file` table. Public by design — these are the same URLs the
    frontend embeds in <img> tags (the old Supabase public URLs were
    public too).

    Image requests fall back to the default cover instead of a hard 404
    so broken covers never break the UI.
    """
    data = load_file(file_id)
    if data:
        content, mime = data
        return Response(content, mimetype=mime, headers=_CACHE_HEADERS)

    # Fallback for images: serve the bundled default cover
    if len(file_id) != 64:
        assets_dir = current_app.config.get('ASSETS_DIR', '')
        for candidate in ('default_cover.jpg',):
            try:
                return send_from_directory(assets_dir, candidate, headers=_CACHE_HEADERS)
            except Exception:
                pass

    return Response("Not Found", status=404)
