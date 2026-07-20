# CORS Fix Plan

## Changes

- Update `backend/config.py` — change default `ALLOWED_ORIGINS` from `'*'` to `'http://localhost:5173'`
- Update `render.yaml` — add explicit `ALLOWED_ORIGINS` env var with the production domain

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] CORS origin is an explicit allowlist of actual domains
- [ ] No wildcard origin (`*`) used
- [ ] `supports_credentials: True` only paired with specific origins
- [ ] render.yaml has ALLOWED_ORIGINS set
