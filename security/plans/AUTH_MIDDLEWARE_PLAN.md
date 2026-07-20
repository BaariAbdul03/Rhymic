# AUTH_MIDDLEWARE Fix Plan

## Changes

- Add `@jwt_required()` to the following routes in `backend/routes/stream.py`:
  - `proxy_audio` (currently public — HIGH risk)
  - `proxy_thumbnail` (currently public)
  
- Add `@jwt_required()` to the following routes in `backend/routes/artists.py`:
  - `get_artist_images` 
  - `get_artist_profile`

- Add `@jwt_required()` to the following routes in `backend/routes/mood.py`:
  - `get_song_mood`

- Note: Songs routes (`/api/songs/` and `/api/songs/<id>`) serve the shared music library, so leaving them public is acceptable.

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] All routes that return or modify user data have auth middleware
- [ ] Auth middleware runs before the handler, not inside it
- [ ] Unauthenticated requests to protected routes return 401
- [ ] Unauthenticated requests to `/api/stream/proxy/<video_id>` return 401

## Manual verification (for the human)

- Send a request to `/api/stream/proxy/somevideo` without a token — expect 401
- Send a request to `/api/artists/images` without a token — expect 401
- Send a request to `/api/mood/some_id` without a token — expect 401
