import os
import time
import threading
from keep_alive import get_config, ping_postgres, ping_rest_api, ping_storage_api


def _keepalive_loop():
    """Background worker loop that runs every 24 hours."""
    # Initial delay on server startup (60s) to let server boot up cleanly
    time.sleep(60)
    
    while True:
        try:
            print("\n[Background Service] Running scheduled Supabase keep-alive ping...")
            db_url, supabase_url, service_key = get_config()
            ping_postgres(db_url, retries=2, backoff=3)
            ping_rest_api(supabase_url, service_key)
            ping_storage_api(supabase_url, service_key)
        except Exception as e:
            print(f"[Background Service] Keep-alive error: {e}")
        
        # Sleep for 24 hours (86400 seconds)
        time.sleep(86400)


def start_background_keepalive():
    """Launches a background daemon thread to periodically ping Supabase."""
    # Avoid running twice in Flask auto-reloader main process
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not os.environ.get("FLASK_ENV"):
        thread = threading.Thread(target=_keepalive_loop, daemon=True, name="SupabaseKeepAliveThread")
        thread.start()
        print("[DB KeepAlive] Background Supabase keep-alive thread started.")
