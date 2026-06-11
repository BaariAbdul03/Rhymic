import os
import base64
import tempfile
import time
import logging

class CookieManager:
    _instance = None
    _cookie_path = None
    _last_check_time = 0
    _CHECK_INTERVAL = 6 * 3600  # 6 hours

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CookieManager, cls).__new__(cls)
        return cls._instance

    def get_cookie_file_path(self):
        if self._cookie_path and os.path.exists(self._cookie_path):
            return self._cookie_path

        b64_cookies = os.environ.get('YT_COOKIES_B64')
        if not b64_cookies:
            return None

        try:
            cookie_data = base64.b64decode(b64_cookies).decode('utf-8')
            fd, temp_path = tempfile.mkstemp(suffix='.txt', prefix='yt_cookies_')
            with os.fdopen(fd, 'w') as f:
                f.write(cookie_data)
            
            # Atomic replace to target path
            target_path = os.path.join(tempfile.gettempdir(), 'yt_cookies.txt')
            os.replace(temp_path, target_path)
            self._cookie_path = target_path
            return self._cookie_path
        except Exception as e:
            logging.error(f"[CookieManager] Failed to decode and write cookies: {e}")
            return None

    def is_cookie_stale(self):
        now = time.time()
        if now - self._last_check_time < self._CHECK_INTERVAL:
            return False

        path = self.get_cookie_file_path()
        if not path:
            return False

        try:
            stale = False
            with open(path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or (line.startswith('#') and not line.startswith('#HttpOnly_')):
                        continue
                    
                    # Remove the #HttpOnly_ prefix if it exists
                    if line.startswith('#HttpOnly_'):
                        line = line[10:]
                        
                    parts = line.split('\t')
                    if len(parts) >= 7:
                        name = parts[5]
                        expiry = int(parts[4])
                        if name in ['SID', 'HSID', 'SSID']:
                            # Check if within 7 days
                            if expiry - now < 7 * 24 * 3600:
                                logging.warning(f"[CookieManager] Cookie {name} is stale or expires within 7 days.")
                                stale = True
            self._last_check_time = now
            return stale
        except Exception as e:
            logging.error(f"[CookieManager] Failed to parse cookie file: {e}")
            return False

cookie_manager = CookieManager()
