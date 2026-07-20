import os
import psycopg2
from keep_alive import get_config

def main():
    print("=" * 60)
    print("      RhyMic -- Disable Row Level Security (RLS)")
    print("=" * 60)
    
    db_url, _, _ = get_config()
    
    if not db_url:
        print("[ERROR] DATABASE_URL is not set!")
        return
        
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=15)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("Disabling RLS on all public schema tables...")
        sql = """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
            END LOOP;
        END $$;
        """
        cursor.execute(sql)
        
        # Verify tables RLS status
        cursor.execute("""
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public';
        """)
        tables = cursor.fetchall()
        
        print("\nTable RLS Status:")
        for table, rls_enabled in tables:
            status = "ENABLED" if rls_enabled else "DISABLED"
            print(f"  * {table:<25} : {status}")
            
        conn.close()
        print("\n[SUCCESS] RLS has been successfully disabled on all public tables!")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to disable RLS: {e}")

if __name__ == "__main__":
    main()
