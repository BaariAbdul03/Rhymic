# RATE_LIMITING Fix Plan

## Changes

- Add rate limiting to AI recommendation endpoint in `backend/routes/ai.py`
- Add rate limiting to artist images endpoint in `backend/routes/artists.py`
- Add rate limiting to stream search endpoint in `backend/routes/stream.py`

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] Login, registration, and password reset have rate limiting
- [ ] AI endpoints have rate limiting
- [ ] Search endpoint has rate limiting
