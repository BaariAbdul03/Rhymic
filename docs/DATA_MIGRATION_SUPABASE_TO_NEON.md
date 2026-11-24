# Data Migration Guide: Supabase → Neon PostgreSQL

One-time, ~15 minutes. Moves **all app rows** (users, songs, playlists,
relations, reset tokens, etc.) from your Supabase Postgres into Neon.
Supabase **Storage** objects (old avatar uploads) are *not* moved — see
"Does not migrate" below.

**Do this before switching `DATABASE_URL` on Render.** Until you flip the
URL, the old app keeps running against Supabase untouched — that is your
instant rollback.

---

## 0. Prerequisites

- `pg_dump` / `psql` (PostgreSQL client 14+): `postgres --version` to check
- Your **Neon project** created (free tier is fine), region close to Render
  (e.g. AWS us-east-1 if your Render service is there)
- Supabase DB **password** (Dashboard → Project Settings → Database) and
  project ref (the `xxxxx` in `aws-0-<region>.pooler.supabase.com`)

Define the two URLs once in your terminal (do not commit these anywhere):

```sh
# Supabase — use the SESSION MODE pooler host (port 5432). It works over
# IPv4; the direct db.xxx.supabase.co host may be IPv6-only.
export SRC="postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres"

# Neon — the POOLED connection string from the Neon dashboard.
export DST="postgresql://<user>:<password>@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require"
```

> Use a pooled URL for the web app and a direct URL for migrations and restores.

---

## 1. Create the schema in Neon (empty tables)

Run the migration script on the empty Neon branch before starting the app.

```sh
pip install -r requirements.txt
DATABASE_URL_UNPOOLED="$DST" python scripts/run_migrations.py
```

Sanity check — list what was created:

```sh
psql "$DST" -c "\dt"
```

## 2. Dump the data from Supabase

**Only the `public` schema** — the app's own tables. Supabase also has
`auth`, `storage`, `realtime` schemas which do NOT exist in Neon and would
make the restore fail:

```sh
pg_dump --data-only --no-owner --no-privileges \
  --schema=public \
  --exclude-table=public.alembic_version \
  --file=supabase_data.sql \
  --dbname="$SRC"
```

Notes:
- `--data-only` output is ordered to satisfy foreign keys and includes the
  `setval(...)` calls that fix all ID sequences — nothing extra needed.
- The dump is plain SQL; open it in an editor if you want to inspect it.

## 3. Restore into Neon

Restore into a fresh migration branch. Keep any existing Neon accounts and
playlists intact by reconciling email addresses and foreign keys before cutover.

```sh
psql --dbname="$DST" \
  --single-transaction \
  --set=ON_ERROR_STOP=1 \
  --file=supabase_data.sql
```

On success you'll see the COPY/INSERT + `setval` results with no errors.

## 4. Verify

Compare row counts on both sides for every app table:

```sh
psql "$SRC" -c "select table_name from information_schema.tables where table_schema='public' order by 1;"
psql "$DST" -c "select table_name from information_schema.tables where table_schema='public' order by 1;"
```

Then spot-check the important ones (adjust names to your schema):

```sh
psql "$SRC" -c 'SELECT count(*) FROM public."user";'
psql "$DST" -c 'SELECT count(*) FROM public."user";'
```

Final test: log in to the app pointed at Neon locally (`DATABASE_URL="$DST"
flask run`) — passwords, playlists and uploads must behave exactly as
before.

## 5. Flip Render to Neon

1. Render Dashboard → your service → **Environment**
2. `DATABASE_URL` → paste the **Neon pooled** URL (keep `?sslmode=require`)
3. Set `DATABASE_URL_UNPOOLED` to the direct URL for the same Neon branch
4. **Manual Deploy** → after boot, open `https://<your-app>.onrender.com/api/health`
   and confirm `"database": "connected"`
5. Create one throwaway account and one upload on the live site

The app pins the `postgresql+psycopg2://` dialect itself, so paste Neon's
URL exactly as Neon gives it — no scheme editing needed.

## 6. Decommission Supabase (after 1–2 days of stable operation)

- Rotate the leaked secrets: Dashboard → Database → **Reset database
  password**; Settings → API → **Rotate** the `service_role` JWT
  (see `docs/SECURITY_ROTATION.md` §2)
- Then **pause or delete** the Supabase project — the app no longer uses it
- No keep-alive job is needed for Neon: the app uses `pool_pre_ping` and
  survives auto-suspend; the first request after a nap is just slightly slower

## Does not migrate

| Item | Why | What happens |
| --- | --- | --- |
| Supabase Storage avatars | Object storage, not DB rows | Old `profile_pic` URLs die; users re-upload (new uploads are stored in Neon `bytea` automatically) |
| `stored_file` table contents | New table, never existed in Supabase | Starts empty; the thumbnail cache rebuilds itself as songs are browsed |
| `auth.users` (Supabase Auth) | App uses its own `public."user"` table with bcrypt | Nothing to do |

## Rollback

At any point before Step 5: change nothing on Render and nothing happens.
After Step 5: set `DATABASE_URL` back to the Supabase pooler URL and
redeploy — rows written to Neon after the switch will not be in Supabase,
so only use this if the cutover failed immediately.
