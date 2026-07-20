# FILE_UPLOADS Security Report

## Status: HIGH

## Findings

### 1. Profile picture upload endpoint (HIGH)
In `backend/routes/auth.py`, the `upload_profile_pic` endpoint:

```python
file = request.files['image']
if file.filename == '':
    return jsonify({"message": "No selected file"}), 400
```

**Issues:**
- **No file type validation by magic bytes (CRITICAL)**: The code does NOT check the actual file content (magic bytes). It only checks if a filename exists.
- **No extension validation**: The file is saved with whatever extension it has:
  ```python
  ext = os.path.splitext(file.filename)[1]
  if not ext:
      ext = '.jpg'
  new_filename = f"{uuid.uuid4().hex}{ext}"
  ```
- **File size is validated** via Flask config `MAX_CONTENT_LENGTH = 5 * 1024 * 1024` (5MB) ✓

### 2. Local file storage location (MEDIUM)
- Files are saved to `ASSETS_DIR/users/` which is within the static assets directory:
  ```python
  users_dir = os.path.join(current_app.config['ASSETS_DIR'], 'users')
  file.save(file_path)
  ```
- Saved to the same domain as the app (no separate storage domain)
- The path is served as `/assets/users/<uuid>.ext`

### 3. UUID filename prevents path traversal (PASS)
- Filenames are renamed to UUIDs server-side ✓
- This prevents path traversal and filename collision attacks ✓

### 4. Supabase storage option exists (PASS)
- The upload first tries Supabase Storage:
  ```python
  remote_url = upload_to_supabase(file_bytes, file.filename)
  ```
- If Supabase is configured, files go to cloud storage ✓

### 5. No server-side size check beyond config (LOW)
- The Flask app has `MAX_CONTENT_LENGTH = 5 * 1024 * 1024` which limits overall request size to 5MB.
- This is a good starting point but there's no additional per-file validation.

## What's at risk

- An attacker could upload executable files (PHP scripts, HTML, SVG with XSS) disguised as images
- If the assets directory is served with script execution enabled, uploaded files could be executed
- No magic byte validation means a `.jpg` file could contain a malicious script

## What's already secure

- UUID-based filenames prevent path traversal ✓
- Supabase cloud storage attempted first ✓
- 5MB request size limit ✓
- Files stored in a subdirectory (not web-root directly) ✓

## Recommendations

1. **Validate file type by magic bytes** — read the first bytes and verify against known image signatures (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, GIF: `47 49 46 38`, WEBP: `52 49 46 46`)
2. **Validate MIME type** from `file.content_type` server-side
3. **Restrict extensions** to only image-safe extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
4. **Re-encode the image** on the server using Pillow to strip any embedded data
5. Move uploads to a separate domain or CDN in production
