import os
import re
import hashlib
import uuid
from pathlib import Path

class ThumbnailCache:
    """
    Persistent disk cache for thumbnail images.

    KEY DESIGN DECISION (Phase 22 Fix):
    Google's lh3.googleusercontent.com URLs contain volatile session tokens
    that expire after time. We must NOT use the full URL as the cache key 
    because after expiry the cache misses and we fetch a broken URL.

    Solution: Strip the volatile token parts from the URL to create a stable key.
    We keep only the stable "image identity" portion before any query params or 
    Google size tokens like '=s0', '=w500-h500', etc.
    This ensures we hit the cache even if the token changes.
    """

    def __init__(self, cache_dir=None):
        if cache_dir is None:
            # Always use an absolute path relative to this file's location
            base_dir = Path(__file__).parent.parent
            cache_dir = str(base_dir / 'data' / 'cache' / 'thumbnails')
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    def _stable_key(self, url):
        """
        Returns a stable, token-independent cache key for a URL.
        For Google CDN: strips session tokens and size parameters.
        For YouTube CDN: strips query string parameters.
        For others: uses the URL as-is.
        """
        if not url:
            return url

        # Google CDN: lh3.googleusercontent.com/...=s0 or =w500-h500
        # The stable identity is everything before the '=' size suffix
        if 'googleusercontent.com' in url or 'ggpht.com' in url:
            # Remove size/token parameters like =s0, =s800, =w500-h500-p
            url = re.sub(r'=[swh]\d+.*$', '', url)
            # Also strip query strings
            url = url.split('?')[0]

        # YouTube CDN: i.ytimg.com - strip query string params (sqp=, rs=)
        elif 'i.ytimg.com' in url:
            url = url.split('?')[0]

        return url

    def _get_hash(self, url):
        stable = self._stable_key(url)
        return hashlib.sha256(stable.encode('utf-8')).hexdigest()

    def get_cached_path(self, url):
        """Returns the absolute local path if cached, else None."""
        file_hash = self._get_hash(url)
        file_path = os.path.join(self.cache_dir, file_hash)

        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            return str(Path(file_path).absolute())
        return None

    def save_to_cache(self, url, response):
        """
        Saves a requests response stream to the cache atomically.
        Uses UUID-based temp files to prevent Windows file-lock collisions
        when multiple threads download different songs concurrently.
        """
        file_hash = self._get_hash(url)
        file_path = os.path.join(self.cache_dir, file_hash)
        temp_path = os.path.join(self.cache_dir, f"{file_hash}.{uuid.uuid4()}.tmp")

        try:
            total_bytes = 0
            with open(temp_path, 'wb') as f:
                if isinstance(response, bytes):
                    f.write(response)
                    total_bytes = len(response)
                else:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        total_bytes += len(chunk)

            if total_bytes == 0:
                print(f"[Cache] Empty image skipped: {url[:80]}")
                os.remove(temp_path)
                return None

            # Atomic rename — only happens on success with non-zero content
            os.replace(temp_path, file_path)
            return str(Path(file_path).absolute())
        except Exception as e:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            print(f"[Cache] Failed to save thumbnail: {e}")
            return None

    def delete_cached(self, url):
        """Remove a stale cache entry so it gets re-fetched."""
        file_hash = self._get_hash(url)
        file_path = os.path.join(self.cache_dir, file_hash)
        if os.path.exists(file_path):
            os.remove(file_path)

# Singleton instance
thumbnail_cache = ThumbnailCache()
