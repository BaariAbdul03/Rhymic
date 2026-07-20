# SSRF Security Report

## Status: MEDIUM

## Findings

### 1. Thumbnail proxy fetches user-provided URLs (HIGH)
- In `backend/routes/stream.py`, the `proxy_thumbnail` route takes user-provided URLs from query parameters:
  ```python
  target_url = request.args.get('url')
  fallback_url = request.args.get('fallback')
  ```
- It fetches these URLs using `requests.get()`:
  ```python
  resp = py_requests.get(target_url, headers=common_headers, timeout=8)
  ```
- **There is NO validation** of the URL before fetching:
  - No private IP range blocking
  - No URL scheme validation (only http/https expected but not enforced)
  - No DNS resolution check
  - No hostname allowlist

### 2. iTunes API calls (MEDIUM)
- In `backend/routes/artists.py`, the artist name from the request is used to construct an iTunes API URL:
  ```python
  clean_name = re.sub(r'(?i)\s*[\(\[]?(feat\.?|ft\.?|with|x|&).+', '', name).strip()
  url = "https://itunes.apple.com/search"
  params = {"term": clean_name, "entity": "musicArtist", "limit": 1}
  resp = requests.get(url, params=params, timeout=5)
  ```
- The URL itself is static (itunes.apple.com), but user input influences query params. This is not SSRF since the hostname is fixed.

### 3. Resolver service (LOW)
- In `backend/services/online_provider.py`, the resolver service fetches from Piped instances:
  ```python
  resp = requests.get(f"{base_url}/streams/{video_id}", timeout=8)
  ```
- The Piped instances come from a dynamic list fetched from `https://piped-instances.kavin.rocks/` or from `YT_PIPED_INSTANCES` env var. The `video_id` is a YouTube video ID (11 chars), not user-controllable in a dangerous way.

### 4. No URL validation before fetch in thumbnail proxy (HIGH)
- The thumbnail proxy does NOT:
  - Validate that the URL starts with `http://` or `https://` (data:// URLs could be used)
  - Block private IPs (127.0.0.1, 10.x.x.x, 172.16.x.x, 192.168.x.x, 169.254.x.x, ::1)
  - Resolve the hostname before fetching
  - Validate the content type before proxying

## What's at risk

- **SSRF via thumbnail proxy**: An attacker could make the server fetch internal services (metadata endpoints, cloud provider metadata APIs like `169.254.169.254`, internal services, etc.)
- If the server has access to internal cloud resources (AWS/GCP metadata), an attacker could steal IAM credentials
- The thumbnail proxy is public (no authentication), making this worse

## What's already secure

- The iTunes API calls use a fixed hostname (itunes.apple.com) — not SSRF-able ✓
- The resolver service uses fixed video IDs and known APIs ✓
- The thumbnail URLs are typically constructed internally (from YouTube CDNs), although the endpoint itself doesn't validate them

## Recommendations

1. **Block private IP ranges** in the thumbnail proxy before making requests
2. **Validate URL scheme** — only allow `http://` and `https://`
3. **Resolve hostname** and verify it's not a private IP before fetching
4. Add a URL validation utility function to `backend/utils/` that all URL-fetching code must use
