# ACCESS_CONTROL Fix Plan

## Status: No critical changes needed

## Changes

Minor code quality improvement — convert `str()` comparisons to direct integer comparisons in playlists.py:
- `backend/routes/playlists.py` — change `str(playlist.user_id) != str(user_id)` to `playlist.user_id != int(user_id)`

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] Ownership checks exist on all routes with resource IDs
- [ ] Failing the ownership check returns 403
