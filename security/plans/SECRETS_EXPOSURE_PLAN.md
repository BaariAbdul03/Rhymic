# SECRETS_EXPOSURE Fix Plan

## Changes

- Create `.env.example` in project root with placeholder values

## New files

- `.env.example` — template for required environment variables

## Verification goals

After implementation, ALL of these must be true:

- [ ] `git ls-files .env` returns nothing
- [ ] No secret patterns found in any source file (checked via grep)
- [ ] No env var prefixed with VITE_ / REACT_APP_ / NEXT_PUBLIC_ contains a secret
- [ ] `.env.example` exists with placeholder values only

## Manual verification (for the human)

- Run `git log --all -p | grep -E '(sk_live_|sk_test_|AKIA|SUPABASE_SERVICE_KEY|password)'` to check historic commits
- Rotate the SUPABASE_SERVICE_KEY if it was ever in git history
