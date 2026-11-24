# Security: Committed Secrets — Rotation Checklist

On 2026-11-24 it was found that this repository previously contained **live
credentials in git**. The files have been removed in this commit, but **git
history still contains them**, and anything ever pushed to a public repo must
be treated as compromised. Complete every step below.

## 1. YouTube OAuth tokens (was: `YT_OAUTH_CREDENTIALS.txt`)

The file contained a Base64 Google OAuth token bundle (access + **refresh**
token, YouTube scopes).

- [ ] Go to <https://myaccount.google.com/permissions> with the account used
      (the burner account) and **remove access** for the related app — this
      revokes the refresh token.
- [ ] Alternatively/also: sign out of all sessions from Google security
      activity page.
- [ ] Generate a **new** credential via `scripts/setup_yt_oauth.sh` if you
      still need YouTube OAuth, and store it ONLY in Render env vars.

## 2. Supabase database password + service_role JWT (was: `keep_alive.py`)

The file hardcoded the Supabase DB password (pooler user
`postgres.vbvlyjqgzvpejxnmyssa`) and the **service_role** key of project
`vbvlyjqgzvpejxnmyssa`.

Even though the app is migrating to Neon:

- [ ] In the Supabase dashboard: **Project Settings → Database → Reset
      database password**.
- [ ] **Project Settings → API → Rotate** the service_role key (or simply
      **delete/pause the project** if you no longer need Supabase at all —
      recommended, since the app no longer uses it).
- [ ] Check Supabase **Auth → Users / Table Editor** for any unexpected rows
      or users created while the key was exposed.

## 3. Other keys — verify, rotate if ever pasted anywhere

`GROQ_API_KEY` / `GOOGLE_API_KEY` were **not** committed (good). If they were
ever shared in screenshots, chats, or logs:

- [ ] Groq: <https://console.groq.com/keys> → delete and re-create the key.
- [ ] Google AI Studio: revoke & regenerate the Gemini key if you keep one
      around (the app no longer needs it).

## 4. Render environment variables

After rotating:

- [ ] Update `DATABASE_URL` on Render to the **Neon pooled connection
      string** (`...pooler...neon.tech/neondb?sslmode=require`).
- [ ] Set `GROQ_API_KEY` (new Groq key).
- [ ] **Delete** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_API_KEY`
      from Render if present.
- [ ] Trigger a manual deploy.

## 5. Scrub git history (optional but recommended)

History rewriting is disruptive (force-push, everyone must re-clone), so do
this only if you are comfortable with it:

```sh
# Using git-filter-repo (pip install git-filter-repo)
git filter-repo --invert-paths --path keep_alive.py --path YT_OAUTH_CREDENTIALS.txt
git push origin --force --all
```

Or use BFG Repo-Cleaner. After rewriting, delete and re-create any API keys
again (rewrites don't rotate anything by themselves).

## 6. Going forward

- Secrets live only in `.env` (git-ignored) and Render env vars (`sync: false`).
- Never commit credential files; the `.gitignore` already covers
  `cookies.txt` and `.env` — add any new credential file you generate.
