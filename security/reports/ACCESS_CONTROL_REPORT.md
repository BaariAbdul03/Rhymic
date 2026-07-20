# ACCESS_CONTROL Security Report

## Status: MEDIUM

## Findings

### Route-by-route ownership analysis:

| Route | Method | Resource ID | Ownership Check? |
|-------|--------|-------------|-----------------|
| `/api/playlists/<playlist_id>` | GET | playlist_id | ✅ Yes: `if not playlist.is_system and str(playlist.user_id) != str(user_id): return 403` |
| `/api/playlists/<playlist_id>` | DELETE | playlist_id | ✅ Yes: `if str(playlist.user_id) != str(user_id) or playlist.is_system:` |
| `/api/playlists/<playlist_id>` | PATCH | playlist_id | ✅ Yes: `if str(playlist.user_id) != str(user_id) or playlist.is_system:` |
| `/api/playlists/add_song` | POST | playlist_id | ✅ Yes: `Playlist.query.filter_by(id=pid, user_id=user_id).first()` |
| `/api/likes/` | GET | user_id | ✅ Implicit: `user_id = get_jwt_identity()` — returns only current user's likes |
| `/api/likes/` | POST | song_id | ✅ Implicit: operates on current user's likes |
| `/api/user/me` | GET | user_id | ✅ Implicit: returns only current user |
| `/api/user/upload_profile_pic` | POST | user_id | ✅ Implicit: modifies only current user |
| `/api/user/update` | PATCH | user_id | ✅ Implicit: modifies only current user |
| `/api/user/change-password` | POST | user_id | ✅ Implicit: modifies only current user |
| `/api/2fa/setup` | POST | user_id | ✅ Implicit: modifies only current user |
| `/api/2fa/enable` | POST | user_id | ✅ Implicit: modifies only current user |

### Issues Found:

1. **Playlist ownership checks use string comparison (LOW)**
   ```python
   if not playlist.is_system and str(playlist.user_id) != str(user_id): 
       return jsonify({"message": "Access denied"}), 403
   ```
   This works because the IDs come from different sources (JWT vs DB), but `str()` conversion is a code smell. If both are integers, direct comparison is cleaner.

2. **No ownership check on song routes (LOW)**
   - Songs are a shared library, so no individual ownership concept applies. ✅ Acceptable.

3. **Auth and ownership are separate checks (PASS)**
   - Authentication (`@jwt_required()`) is a separate decorator from ownership checks inside handlers. ✓

4. **Liked songs — user can only see their own (PASS)**
   - The likes GET route filters by `user_id = get_jwt_identity()`. No user can see another user's likes. ✓

## What's at risk

- Low risk. The main user-owned resources (playlists, likes, profile) all have ownership checks.
- The `str()` comparison is a minor concern but not exploitable.

## What's already secure

- All user-owned resources verify ownership ✓
- Auth and ownership checks are separated ✓
- System playlists cannot be deleted or renamed by users ✓
- Each user can only see/modify their own likes ✓

## Recommendations

1. No critical changes needed.
2. Consider removing `str()` conversion and using direct integer comparison for cleanliness.
