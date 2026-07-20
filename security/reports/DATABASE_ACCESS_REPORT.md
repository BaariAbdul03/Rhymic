# DATABASE_ACCESS Security Report

## Status: CRITICAL

## Findings

### 1. `disable_rls.py` — Script to DISABLE Row Level Security (CRITICAL)
- Found at project root: `disable_rls.py` — this script **explicitly disables RLS on all public tables** in the PostgreSQL database.
- It iterates over all public schema tables and runs `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;`
- The output message says: `"[SUCCESS] RLS has been successfully disabled on all public tables!"`
- **This is the opposite of what's secure.** If this script exists in the repo, there's a high chance RLS has been intentionally disabled in production.
- The script is tracked in git (not in .gitignore).

### 2. SQLite fallback (PASS for local dev)
- The app uses SQLite as a fallback when PostgreSQL is unreachable. SQLite has no RLS concept, which is acceptable for local development.

### 3. Direct database access from Flask (MEDIUM)
- The app uses Flask-SQLAlchemy ORM throughout, which provides parameterized queries.
- There is no direct client-side database access — all DB interactions go through the Flask backend. ✓

### 4. Supabase RLS Policies (CRITICAL — cannot verify)
- The Supabase configuration is not checked into the repo.
- We cannot verify if RLS is enabled on the Supabase project.
- The existence of `disable_rls.py` strongly suggests RLS may not be configured.
- There are **no migration files for RLS policies** in the `migrations/` directory.

### 5. No RLS policy files in the project (HIGH)
- The project contains database models with foreign key relationships (users, playlists, songs, likes) but has **no RLS policy definitions** anywhere.
- In a Supabase deployment, the anon key could potentially access any table if RLS is disabled.

## What's at risk

- **If RLS is disabled on Supabase**: Anyone with the Supabase anon key (which is public in client-side code) can read, modify, or delete all data in the database — user accounts, playlists, liked songs, everything.
- Even if RLS was temporarily enabled and then disabled via `disable_rls.py`, all data becomes publicly accessible.

## What's already secure

- Database access from the Flask app uses ORM (SQLAlchemy) with parameterized queries ✓
- No raw user queries are sent to the database ✓
- No database credentials are in client-side code ✓

## Recommendations

1. **Immediately remove or archive `disable_rls.py`** — this should never be tracked in the repo.
2. **Enable RLS on ALL Supabase tables**: `user`, `song`, `playlist`, `playlist_song`, `liked_song`, `song_moods`, `artist_image`
3. **Create RLS policies** scoped to `auth.uid()` for user-owned tables.
4. **Add a migration** that configures RLS so it's tracked in code.
5. **Verify live Supabase project** RLS status via the Supabase dashboard.
