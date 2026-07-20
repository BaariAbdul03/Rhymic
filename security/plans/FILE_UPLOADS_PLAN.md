# FILE_UPLOADS Fix Plan

## Changes

- Update `backend/routes/auth.py` — `upload_profile_pic` function:
  - Add magic byte validation for uploaded files
  - Add extension whitelist
  - Add MIME type validation
  - Add Pillow re-encoding to strip malicious content

## New files

None (update existing route)

## Verification goals

After implementation, ALL of these must be true:

- [ ] File type validated by magic bytes, not extension
- [ ] Files renamed to UUIDs server-side
- [ ] Size limits enforced server-side
- [ ] Only image extensions allowed (.jpg, .jpeg, .png, .gif, .webp)
