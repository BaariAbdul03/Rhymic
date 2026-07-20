# SSRF Fix Plan

## Changes

- Create `backend/utils/url_validator.py` with URL validation and private IP blocking
- Update `backend/routes/stream.py` `proxy_thumbnail` to validate URLs before fetching

## New files

- `backend/utils/url_validator.py` — URL validation utility:
  - Validate URL scheme (only http/https)
  - Resolve hostname to IP
  - Check IP against private ranges
  - Function: `validate_url(url)` returning `(is_valid, error_message)`

## Verification goals

After implementation, ALL of these must be true:

- [ ] All user-supplied URL fetching validates the URL before requesting
- [ ] Private IP ranges are blocked
- [ ] Only http and https schemes are allowed
- [ ] Hostname is resolved and IP checked before the request is made
- [ ] A request to `http://169.254.169.254/latest/meta-data/` returns an error
