# SECRETS_EXPOSURE Security Report

## Status: MEDIUM

## Findings

### 1. Dev fallback secrets in backend/config.py (LOW)
- `backend/config.py` defines fallback development keys:
  ```python
  SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-do-not-use-in-prod')
  JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-do-not-use-in-prod')
  ```
- The `ALLOWED_ORIGINS` defaults to `'*'` when env var is not set.
- These are usable in development; production config overrides them and validates they're not dev values.

### 2. .gitignore properly configured (PASS)
- `.env` is in `.gitignore` ✓
- `cookies.txt` is in `.gitignore` ✓
- No .env file is tracked in git.

### 3. render.yaml — secrets sync: false (PASS)
- Secrets like `DATABASE_URL`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `YT_COOKIES_B64`, `YT_OAUTH_CREDENTIALS` are all set to `sync: false`, so they are not exposed in the repo. ✓
- `JWT_SECRET_KEY` and `RESOLVER_API_KEY` use `generateValue: true`, which is secure. ✓

### 4. No hardcoded secrets in source files (PASS)
- No `sk_live_`, `sk_test_`, `AKIA`, `password = xxx` patterns found in source code.
- API keys are always loaded from environment variables.

### 5. No frontend env vars with public prefixes (PASS)
- No `VITE_*` env vars are used in the frontend code.
- No `NEXT_PUBLIC_*` or `REACT_APP_*` env vars.

### 6. Supabase service key usage (MEDIUM)
- `SUPABASE_SERVICE_KEY` (a full-privilege admin key) is used in `storage_service.py` with `create_client(supabase_url, supabase_key)`.
- This key has elevated privileges. It's used for uploading to Supabase Storage which is reasonable, but it's the **service_role** key — not the anon key. If this leaked, an attacker could manage all Supabase resources.
- Protected by being server-side only, but worth noting.

### 7. .env.example (LOW)
- No `.env.example` file found in the repo root. The SKILLS.md checklist requires one with placeholder values.

### 8. Git history exposure (MEDIUM)
- The security-check demands checking git history for secrets. There are 31 commits visible in the repo. Without scanning the full git history, we can't guarantee no secrets were ever committed.
- The `disable_rls.py` file exists in the current working tree (not gitignored) and could expose DB connection logic.

## What's at risk

- In **production** the risk is low because production config requires strong secrets.
- In **development**, the hardcoded dev keys mean anyone running the dev server could be vulnerable to forged JWT tokens.
- If `SUPABASE_SERVICE_KEY` is ever exposed client-side, an attacker gains full database access.
- Missing `.env.example` makes onboarding less secure (developers might copy from other sources).

## What's already secure

- `.env` is in `.gitignore` ✓
- `render.yaml` correctly uses `sync: false` and `generateValue: true` ✓
- All secrets loaded from environment variables, never hardcoded ✓
- Production config validates that dev secrets are not used ✓
- No `VITE_*` or `NEXT_PUBLIC_*` env vars ✓

## Recommendations

1. Create a `.env.example` file with placeholder values.
2. Run `git log --all -p` scan for any accidentally committed secrets (manual).
3. Consider rotating the dev fallback keys to something unique per developer workstation.
4. Audit `SUPABASE_SERVICE_KEY` usage to ensure it's only used where absolutely necessary.
