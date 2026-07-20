# DEPENDENCIES Fix Plan

## Changes

- Pin exact versions in `requirements.txt`
- Commit `package-lock.json` if not already committed
- (Optional) Add `npm audit` / `pip audit` to CI workflow

## New files

None

## Verification goals

After implementation, ALL of these must be true:

- [ ] Every dependency verified as legitimate on its registry
- [ ] Exact versions pinned (no `^` or `~` in production)
- [ ] Lock files committed
- [ ] `npm audit` shows no critical or high vulnerabilities

## Manual verification (for the human)

- Run `npm audit` in both `rhymic-react/` and `backend/resolver/`
- Run `pip list --outdated` in the Python environment
