# AUTH_MIDDLEWARE Security Report

## Status: HIGH

## Findings

### Route-by-route analysis:

| Route | Method | Auth Required? | Notes |
|-------|--------|---------------|-------|
| `/api/signup` | POST | ❌ No | Rate-limited only |
| `/api/login` | POST | ❌ No | Rate-limited only |
| `/api/forgot-password` | POST | ❌ No | Rate-limited only |
| `/api/reset-password` | POST | ❌ No | Rate-limited only |
| `/api/2fa/verify` | POST | ✅ Yes (`@jwt_required()`) | Checks for temp_2fa claim |
| `/api/2fa/setup` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/2fa/enable` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/user/me` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/user/upload_profile_pic` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/user/update` | PATCH | ✅ Yes (`@jwt_required()`) | |
| `/api/user/change-password` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/songs/` | GET | ❌ **No auth** | **Returns ALL songs — public** |
| `/api/songs/<id>` | GET | ❌ **No auth** | Returns individual song |
| `/api/playlists/` | GET | ✅ Yes (`@jwt_required()`) | Returns user's + system playlists |
| `/api/playlists/<id>` | GET | ✅ Yes (`@jwt_required()`) | Ownership check present |
| `/api/playlists/` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/playlists/<id>` | DELETE | ✅ Yes (`@jwt_required()`) | Ownership check present |
| `/api/playlists/<id>` | PATCH | ✅ Yes (`@jwt_required()`) | Ownership check present |
| `/api/playlists/add_song` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/likes/` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/likes/` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/ai/recommend` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/ai/categorize-genres` | POST | ✅ Yes (`@jwt_required()`) | |
| `/api/artists/images` | POST | ❌ **No auth** | **Public — anyone can trigger external API calls** |
| `/api/artists/<name>/profile` | GET | ❌ **No auth** | **Public — returns artist data** |
| `/api/mood/<song_id>` | GET | ❌ **No auth** | **Public — returns mood data** |
| `/api/stream/search` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/stream/status` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/stream/categories` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/stream/audio/<video_id>` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/stream/proxy/<video_id>` | GET | ❌ **No auth** | **Public — streams audio to anyone** |
| `/api/stream/thumbnail` | GET | ❌ **No auth** | **Public — proxies images** |
| `/api/stream/trending` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/stream/related/<video_id>` | GET | ✅ Yes (`@jwt_required()`) | |
| `/api/health` | GET | ❌ No auth | Health check — acceptable |
| `/api/metrics` | GET | ❌ **No auth** | **Monitroing data — low sensitivity** |
| `/api/` | GET | ❌ No auth | Static file serving — acceptable |

### Key Issues:

1. **`/api/songs/` and `/api/songs/<id>` have NO auth (MEDIUM)**
   - These endpoints return ALL song data from the library. The song data itself isn't user-private (it's a shared music library), but per the SKILLS.md rules, routes that return data should have auth.

2. **`/api/artists/images` and `/api/artists/<name>/profile` have NO auth (MEDIUM)**
   - These are public endpoints. They trigger external API calls (iTunes, Gemini) and return artist data. The external API calls on unauthenticated endpoints could be abused for SSRF or cost abuse.

3. **`/api/mood/<song_id>` has NO auth (MEDIUM)**
   - Returns mood analysis using Gemini AI. Could be abused for cost abuse.

4. **`/api/stream/proxy/<video_id>` has NO auth (HIGH)**
   - This endpoint streams audio directly. Anyone with the URL can consume bandwidth. Since the resolver (yt-dlp/node) costs real compute, unauthenticated access could lead to resource exhaustion.

5. **`/api/stream/thumbnail` has NO auth (MEDIUM)**
   - Proxies/caches images. Abuse potential is limited but exists.

6. **Auth middleware runs BEFORE the handler (PASS)**
   - `@jwt_required()` decorator runs before the route handler. ✓

7. **Unauthenticated returns 401 (PASS)**
   - The JWT decorator returns 401 when no valid token is provided. ✓

### Recommendation for `/api/songs/`:
Song data is a shared library, so making it public may be intentional. However, the artist images and mood endpoints should be protected.

## What's at risk

- Unauthenticated audio streaming could drain bandwidth budget
- Unauthenticated external API calls (iTunes, Gemini) could lead to API cost abuse
- The auth-check pattern is inconsistent

## What's already secure

- User-data routes (playlists, likes, user profile) all require auth ✓
- Auth is checked via decorator (before handler) ✓
- 401 errors returned correctly ✓
- Admin endpoints aren't present, but user ownership checks exist ✓

## Recommendations

1. Add `@jwt_required()` to `proxy_audio` route (`stream.py`)
2. Add `@jwt_required()` to `proxy_thumbnail` route
3. Add `@jwt_required()` to `get_artist_images` and `get_artist_profile`
4. Add `@jwt_required()` to `get_song_mood`
5. Add `@jwt_required()` to songs endpoints (or accept them as public library)
