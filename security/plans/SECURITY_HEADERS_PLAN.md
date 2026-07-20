# SECURITY_HEADERS Fix Plan

## Changes

- Update `backend/__init__.py` — add CSP and HSTS headers to the `security_headers` after_request handler
- Remove deprecated `X-XSS-Protection` header

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] Content-Security-Policy header present on all responses
- [ ] Strict-Transport-Security header present on all responses
- [ ] X-Content-Type-Options: nosniff present
- [ ] X-Frame-Options: DENY present
- [ ] Referrer-Policy: strict-origin-when-cross-origin present
- [ ] All headers set via a single global middleware
