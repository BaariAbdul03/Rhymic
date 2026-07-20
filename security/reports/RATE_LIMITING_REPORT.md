# RATE_LIMITING Security Report

## Status: MEDIUM

## Findings

### 1. Rate limiting configured on auth endpoints (PASS)
In `backend/routes/auth.py`:
```python
@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("3 per minute; 10 per hour")
def signup():

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def login():

@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per minute; 10 per hour")
def forgot_password():

@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def reset_password():
```
- Signup: 3 per minute, 10 per hour ✓
- Login: 5 per minute, 20 per hour ✓
- Forgot password: 3 per minute, 10 per hour ✓
- Reset password: 5 per minute, 20 per hour ✓

### 2. Rate limiter initialized with IP-based key (PASS)
```python
# backend/extensions.py
limiter = Limiter(key_func=get_remote_address)
```
- Uses `get_remote_address` which uses the request's remote IP. ✓

### 3. No rate limiting on other endpoints (MEDIUM)
- The `/api/ai/recommend` endpoint has no rate limiting. This calls external AI APIs (Groq, Gemini) and could be abused for cost.
- The `/api/ai/categorize-genres` endpoint has no rate limiting.
- The `/api/stream/search` endpoint has no rate limiting.
- The `/api/artists/images` endpoint has no rate limiting.

### 4. Rate limit storage (MEDIUM)
```python
RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
```
- Default storage is **in-memory**, meaning rate limits reset when the server restarts. For production with multiple workers, a shared storage (Redis) should be used.
- In production (Gunicorn with 2 workers), the memory store is per-worker, effectively doubling the allowed limits.

### 5. X-Forwarded-For spoofing (MEDIUM)
- The limiter uses `get_remote_address` which, by default, checks `X-Forwarded-For` headers if running behind a proxy.
- In production, the app runs behind Render's proxy. This makes `X-Forwarded-For` reliable. However, an attacker could spoof the header if the proxy isn't properly configured.

## What's at risk

- AI endpoint abuse could lead to unexpected API costs
- Rate limits are doubled in production (per-worker memory store)
- No rate limiting on search/artist endpoints

## What's already secure

- All auth endpoints have rate limiting ✓
- Reasonable limits (5 per minute for login is standard) ✓
- Limiter configured at app level ✓

## Recommendations

1. Add rate limiting to AI endpoints (`/api/ai/recommend`, `/api/ai/categorize-genres`)
2. Add rate limiting to search endpoints
3. Consider using Redis for rate limit storage in production
4. Set `RATELIMIT_STORAGE_URI` to a Redis URL in production config
