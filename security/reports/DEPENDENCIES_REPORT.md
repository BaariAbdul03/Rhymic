# DEPENDENCIES Security Report

## Status: MEDIUM

## Findings

### 1. Python dependencies (requirements.txt) (MEDIUM)
```
Flask
Flask-Cors
gunicorn
Flask-SQLAlchemy
Flask-Migrate
Flask-Bcrypt
Flask-JWT-Extended
Flask-Limiter
google-genai
python-dotenv
email_validator
requests
psycopg2-binary
ytmusicapi
yt-dlp
pyotp
qrcode
supabase
```
- **Versions are NOT pinned** — no `==` or `>=` specifiers used.
- `requirements.txt` uses bare package names, which means builds are non-reproducible.
- No lock file (e.g., `poetry.lock`, `pip freeze` output) is committed.

### 2. Node.js dependencies (package.json) (MEDIUM)
```json
"dependencies": {
    "@hello-pangea/dnd": "^18.0.1",
    "axios": "^1.13.6",
    "framer-motion": "^11.0.0",
    ...
}
```
- Versions use `^` (caret) ranges, not exact pins.
- `package-lock.json` is NOT listed in `.gitignore`, but we need to verify it's committed.

### 3. Resolver service (package.json) (MEDIUM)
```json
"dependencies": {
    "concurrently": "^10.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "youtubei.js": "^17.0.1"
}
```
- Same issue — caret ranges, not pinned.
- `cors` package version `2.8.5` is quite old (latest is 2.8.5 from 2020 — acceptable).

### 4. All packages are legitimate (PASS)
- All packages checked are well-known with significant download counts:
  - `Flask` — extremely popular Python web framework ✓
  - `requests` — standard HTTP library ✓
  - `yt-dlp` — 30k+ stars on GitHub ✓
  - All npm packages well-known ✓

### 5. No lock files committed (HIGH)
- Need to verify: `package-lock.json` should be committed.
- No Python lock file (Pipfile.lock, poetry.lock) is present.

## What's at risk

- **Non-reproducible builds**: Different versions may be installed on different machines or at different times.
- **Supply chain attacks**: If a dependency is compromised (e.g., a malicious update to a minor version), the app could receive the malicious code automatically.
- **Known vulnerabilities**: Without pinning, vulnerable versions could be installed.

## What's already secure

- All packages are well-known and legitimate ✓
- No suspicious or unknown packages ✓
- React packages are from the official npm registry ✓

## Recommendations

1. **Pin exact versions** in `requirements.txt` using `pip freeze` output.
2. **Commit `package-lock.json`** for Node.js projects.
3. **Run `npm audit` and `pip audit`** regularly.
4. Consider using a Python dependency lock manager (Poetry or pip-tools).
