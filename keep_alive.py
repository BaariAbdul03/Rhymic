import os
import sys
import time
import requests

# Fix encoding issues on Windows consoles
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Fallback credentials matching current project environment
DEFAULT_DB_URL = "postgresql://postgres.vbvlyjqgzvpejxnmyssa:MaQl6nttAJJRM6gx@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
DEFAULT_SUPABASE_URL = "https://vbvlyjqgzvpejxnmyssa.supabase.co"
DEFAULT_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidmx5anFnenZwZWp4bm15c3NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE5NzM2NCwiZXhwIjoyMDkyNzczMzY0fQ.5I-3uVTsnx_HPBgT_kZf1ACqmMDSPh3wpqMsBYyXJyQ"


def get_config():
    db_url = os.environ.get("DATABASE_URL") or DEFAULT_DB_URL
    supabase_url = os.environ.get("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    service_key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
        or DEFAULT_SERVICE_KEY
    )
    
    # Standardize postgres protocol prefix if needed
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return db_url, supabase_url, service_key


def ping_postgres(db_url, retries=3, backoff=5):
    """Executes direct SQL query against Supabase PostgreSQL database."""
    print("\n--- [1/3] Direct PostgreSQL Database Ping ---")
    try:
        import psycopg2
    except ImportError:
        print("[!] 'psycopg2' library missing. Run 'pip install psycopg2-binary'")
        return False

    for attempt in range(1, retries + 1):
        try:
            print(f"Connecting to PostgreSQL (Attempt {attempt}/{retries})...")
            conn = psycopg2.connect(db_url, connect_timeout=15)
            cursor = conn.cursor()
            
            # Execute SQL queries that count as active database traffic
            cursor.execute("SELECT NOW(), version();")
            db_time, version = cursor.fetchone()
            
            cursor.execute("SELECT count(*) FROM information_schema.tables;")
            table_count = cursor.fetchone()[0]
            
            conn.close()
            print("[OK] PostgreSQL Connection Successful!")
            print(f"     DB Server Time: {db_time}")
            print(f"     PostgreSQL Version: {version.split(',')[0]}")
            print(f"     Active Schema Tables: {table_count}")
            return True
        except Exception as e:
            print(f"[WARN] Attempt {attempt} failed: {type(e).__name__}: {e}")
            if attempt < retries:
                print(f"       Waiting {backoff} seconds before retrying (giving DB time to resume)...")
                time.sleep(backoff)

    print("[FAIL] All PostgreSQL connection attempts failed.")
    return False


def ping_rest_api(supabase_url, service_key):
    """Pings Supabase PostgREST API endpoint with authentication headers."""
    print("\n--- [2/3] Supabase REST API Ping ---")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/"
    try:
        print(f"Pinging {endpoint} ...")
        response = requests.get(endpoint, headers=headers, timeout=15)
        print(f"HTTP Status Code: {response.status_code}")
        if response.status_code in (200, 201, 204):
            print("[OK] Supabase REST API Ping Successful!")
            return True
        else:
            print(f"[WARN] REST API returned unexpected status {response.status_code}: {response.text[:200]}")
            return response.status_code < 500
    except Exception as e:
        print(f"[FAIL] REST API Ping Failed: {e}")
        return False


def ping_storage_api(supabase_url, service_key):
    """Pings Supabase Storage API to ensure storage service stays active."""
    print("\n--- [3/3] Supabase Storage API Ping ---")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    endpoint = f"{supabase_url.rstrip('/')}/storage/v1/bucket"
    try:
        print(f"Pinging {endpoint} ...")
        response = requests.get(endpoint, headers=headers, timeout=15)
        print(f"HTTP Status Code: {response.status_code}")
        if response.status_code in (200, 201):
            buckets = response.json()
            print(f"[OK] Supabase Storage Ping Successful! ({len(buckets)} bucket(s) found)")
            return True
        else:
            print(f"[WARN] Storage API returned HTTP status {response.status_code}")
            return response.status_code < 500
    except Exception as e:
        print(f"[FAIL] Storage API Ping Failed: {e}")
        return False


def main():
    print("=" * 60)
    print("      RhyMic Enterprise -- Supabase Keep Alive System")
    print("=" * 60)

    db_url, supabase_url, service_key = get_config()
    print(f"Target Supabase Host: {supabase_url}")
    
    pg_ok = ping_postgres(db_url)
    rest_ok = ping_rest_api(supabase_url, service_key)
    storage_ok = ping_storage_api(supabase_url, service_key)

    print("\n" + "=" * 60)
    print("SUMMARY OF KEEP ALIVE RESULTS:")
    print(f"  * PostgreSQL DB Ping:  {'[OK] SUCCESS' if pg_ok else '[FAIL] FAILED'}")
    print(f"  * REST API Ping:       {'[OK] SUCCESS' if rest_ok else '[FAIL] FAILED'}")
    print(f"  * Storage API Ping:    {'[OK] SUCCESS' if storage_ok else '[FAIL] FAILED'}")
    print("=" * 60)

    if pg_ok or rest_ok:
        print("[SUCCESS] Overall Keep-Alive: SUCCESS! Supabase is active and responsive.")
        sys.exit(0)
    else:
        print("[CRITICAL] Overall Keep-Alive: FAILURE! Unable to communicate with Supabase.")
        sys.exit(1)


if __name__ == "__main__":
    main()
