# DATABASE_ACCESS Fix Plan

## Changes

- Move `disable_rls.py` to a non-executable location or remove from repo (it's an anti-pattern)
- Create a `supabase_rls.sql` migration file with proper RLS policies for all tables

## New files

- `migrations/supabase_rls.sql` — SQL file with RLS policy definitions

## Verification goals

After implementation, ALL of these must be true:

- [ ] `disable_rls.py` is removed or gitignored
- [ ] RLS policy SQL file exists for all tables
- [ ] Each table has explicit policies scoped to auth.uid()
- [ ] No policy uses `USING (true)` without a proper condition

## Manual verification (for the human)

- Connect to Supabase and run: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
- Verify RLS is ENABLED on every table
- Try a curl request with just the anon key to read user data — should return 401/403
