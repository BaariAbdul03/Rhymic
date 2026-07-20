# CORS Security Report

## Status: HIGH

## Findings

### 1. CORS configured with wildcard origin by default (HIGH)
In `backend/config.py`:
```python
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*').split(',')
```

In `backend/__init__.py`:
```python
allowed_origins = app.config.get('ALLOWED_ORIGINS', ['*'])
cors.init_app(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)
```

- **When `ALLOWED_ORIGINS` env var is not set, it defaults to `*` (wildcard).**
- **`supports_credentials=True` WITH a wildcard origin is a security violation** — browsers will reject this, but it's a sign of incorrect configuration.
- CORS should never use `*` with credentials.

### 2. Production render.yaml does NOT set ALLOWED_ORIGINS (MEDIUM)
- The `render.yaml` deployment config does not include `ALLOWED_ORIGINS` in its env vars.
- This means production would also default to `*`.

### 3. No dynamic origin reflection (PASS)
- The app does not reflect the request `Origin` header back in CORS headers, which would be a much more serious vulnerability. ✓

## What's at risk

- A wildcard CORS origin with `supports_credentials=True` means any website can make credentialed requests to the API.
- However, since the app uses JWT in Authorization header (not cookies), credentials aren't auto-sent. The `Access-Control-Allow-Credentials: true` header is still risky in combination with `*`.

## What's already secure

- CORS is configured at the framework level (flask-cors) ✓
- In production, the ALLOWED_ORIGINS env var can be set (just isn't in render.yaml) ✓
- The auth mechanism (JWT in header) mitigates some of the CORS risk ✓

## Recommendations

1. **Set `ALLOWED_ORIGINS` explicitly** in `render.yaml` to the actual production domain.
2. **Change default** from `*` to `http://localhost:5173` (Vite dev server) or empty string.
3. **Only set `supports_credentials=True`** when using specific origins.
