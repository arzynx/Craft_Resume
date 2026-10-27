# Deploying honest-resume (beginner guide, Windows)

The app is a static website (`web/`) plus a small Supabase backend (`supabase/`):
a Postgres database for optional sync and four Edge Functions. **Rules-only mode is the
complete product.** Nothing in this guide is required just to use the app locally; it is
for publishing it with sign-in, sync and the optional AI helpers.

## What runs where

| Piece | Where it runs | Needs a secret? | Sends student data anywhere? |
|---|---|---|---|
| Rules engine (`core/`) | In the browser **and** inside the edge functions | No | No. Runs on the device. |
| `extract` (rules) | Edge function | No | Only the job posting text, if the student clicks "fetch/extract online". |
| `extract` (AI), `reword` (AI) | Edge function only | `ANTHROPIC_API_KEY` | Job posting text and the selected bullet text, **after** contact details are stripped. Only when the student has turned AI on. |
| `fetch-posting` | Edge function | No | Only the posting URL. |
| `verify-company` | Edge function | No | Only the company name. |
| Profile, photo, snapshots | Browser localStorage | No | Never, unless the student signs in and turns sync on. The photo is never synced or sent. |
| Sync (`profiles`, `snapshots`, `app_settings`) | Supabase Postgres, row-level security | No | Only after opt-in sign-in (magic link). |

Nothing leaves the device unless the student opts in. The AI key lives only on the server.

---

## 0. Prerequisites

- Windows 10/11, PowerShell.
- Node.js 20 or newer (https://nodejs.org) - used for `npm test` and `npm run serve`.
- Git (https://git-scm.com).
- Docker Desktop (https://www.docker.com/products/docker-desktop/) - only needed for **local** Supabase (`supabase start`). You can skip it and deploy straight to the cloud.
- A free Supabase account (https://supabase.com).

## 1. Install the Supabase CLI

Pick one:

**Option A - Scoop (recommended, keeps it updated)**

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # one time, if scripts are blocked
irm get.scoop.sh | iex                                  # installs Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

**Option B - npx (no install)**

Prefix every `supabase ...` command below with `npx `, for example `npx supabase login`.

## 2. Log in and create a project

```powershell
supabase login
```

This opens the browser; approve the access token.

Then in the dashboard (https://supabase.com/dashboard): **New project** -> choose a name
(e.g. `honest-resume`), a strong database password (save it), and the region closest to
your students (e.g. Mumbai / `ap-south-1`). Wait a minute for it to provision.

Find the **project ref** in Project Settings -> General (a 20-character id, also in the URL).

## 3. Link the repo to the project

From the repo root (`D:\Apps\honest-resume`):

```powershell
supabase link --project-ref <your-project-ref>
```

It asks for the database password you chose in step 2.

## 4. Create the tables

```powershell
supabase db push
```

This applies `supabase/migrations/0001_init.sql`: tables `profiles`, `snapshots`,
`app_settings`, with row-level security so each student can only read/write their own rows.

Check in the dashboard: Table Editor should show the three tables.

## 5. Copy the core engine into the functions

The edge functions import the shared engine from `supabase/functions/_shared/core/`.
That folder is generated, so run the sync script before every deploy:

```powershell
node scripts/sync-core.mjs
```

## 6. Deploy the edge functions

```powershell
supabase functions deploy extract fetch-posting verify-company reword --no-verify-jwt
```

`--no-verify-jwt` lets the public anon key call these helpers (they hold no user data;
the database is protected by row-level security, not by these functions). The same
setting is recorded in `supabase/config.toml`.

## 7. (Optional) Turn on AI

Only if you want AI extraction and bullet rewording. Get a key at
https://console.anthropic.com, then:

```powershell
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Without this secret every function answers in rules mode and says so in a `note`.
Never put this key in `web/config.js` or any file under `web/`.

## 8. Enable email (magic link) sign-in

Dashboard -> Authentication -> Providers -> **Email**: make sure it is enabled.
Keep "Confirm email" on if you like; magic links work either way.

Dashboard -> Authentication -> URL Configuration:
- **Site URL**: where you will host `web/` (e.g. `https://yourname.github.io/honest-resume/`).
- **Redirect URLs**: add the same URL, plus `http://localhost:8080` for local testing.

## 9. Point the web app at your project

Dashboard -> Project Settings -> API. Copy **Project URL** and the **anon public** key into
`web/config.js` (the anon key is safe to publish; it only grants what row-level security allows):

```js
export const SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

The functions are reachable at `https://<your-project-ref>.supabase.co/functions/v1/<name>`.

## 10. Host the website

Supabase does not host static sites. `web/` is plain HTML/JS, so any static host works:

- **GitHub Pages**: push the repo, Settings -> Pages -> Deploy from branch, folder `/web`
  (or copy `web/` to a `docs/` folder / `gh-pages` branch). URL: `https://<user>.github.io/<repo>/`.
- **Netlify**: drag-and-drop the `web/` folder at https://app.netlify.com/drop, or connect the
  repo with publish directory `web`.
- **Vercel**: `npx vercel web` (set the root directory to `web`, no build command).

Then put the final URL into Authentication -> URL Configuration (step 8).

---

## Running everything locally

Local Supabase (needs Docker Desktop running):

```powershell
supabase start                      # starts Postgres, auth, API; prints local URL + anon key
supabase db reset                   # applies migrations to the local DB
node scripts/sync-core.mjs
supabase functions serve --no-verify-jwt --env-file .env   # serves all functions on :54321
```

Create `.env` from `.env.example` (leave the key empty for rules-only mode).
Magic-link emails for local auth appear in Inbucket at http://localhost:54324.

In a second terminal, serve the website:

```powershell
npm run serve                       # serves web/ on http://localhost:8080
```

Use the local URL and anon key printed by `supabase start` in `web/config.js` while testing.
Local function URL: `http://localhost:54321/functions/v1/<name>`.

---

## Smoke tests (curl)

Replace `$URL` and `$KEY`:

- cloud: `$URL = "https://<ref>.supabase.co/functions/v1"`, `$KEY = "<anon key>"`
- local: `$URL = "http://localhost:54321/functions/v1"`, `$KEY = "<local anon key>"`

PowerShell has a `curl` alias that is not real curl; use `curl.exe`.

```powershell
$URL = "https://<ref>.supabase.co/functions/v1"
$KEY = "<anon key>"
$H = @("-H", "Authorization: Bearer $KEY", "-H", "apikey: $KEY", "-H", "Content-Type: application/json")
```

**extract** (rules; add `"useAI": true` to try AI when the secret is set)

```powershell
curl.exe -s -X POST "$URL/extract" @H -d '{"title":"Video Editing Intern","jdText":"We need a video editing intern. Must know Premiere Pro. Knowledge of After Effects is a plus. Remote, 3 months, stipend 8000 per month. Share your portfolio link. No fee."}'
```

Expect `{"extraction":{...},"mode":"rules"}`.

**fetch-posting**

```powershell
curl.exe -s -X POST "$URL/fetch-posting" @H -d '{"url":"https://example.com/"}'
```

Expect `{"ok":false,"reason":"no_description",...}` for example.com; a real posting page
returns `{"ok":true,"text":"...","title":"..."}`. LinkedIn/Internshala usually return
`reason: "login"` with a message saying to paste the text.

**verify-company**

```powershell
curl.exe -s -X POST "$URL/verify-company" @H -d '{"name":"Zomato"}'
```

Expect `status` of `found`, `multiple`, `could_not_confirm` or `not_checked`, plus a
`note` that spells out exactly what was and was not verified.

**reword**

```powershell
curl.exe -s -X POST "$URL/reword" @H -d '{"bullets":[{"id":"b1","text":"I edited videos for the college fest and they were posted on Instagram"}],"confirmedSkills":["Premiere Pro"],"family":"editing_video"}'
```

Without `ANTHROPIC_API_KEY` expect `mode: "rules"` and `ok: false` (original kept).
With the key, `mode: "ai"`, and each bullet is `ok: true` only if it passed the guard
(verb first, no new numbers/tools, no banned level words, max 110 chars).

**CORS preflight**

```powershell
curl.exe -s -i -X OPTIONS "$URL/extract" -H "Origin: http://localhost:8080" -H "Access-Control-Request-Method: POST"
```

Expect `204` with `Access-Control-Allow-Origin: *`.

---

## Updating later

```powershell
git pull
node scripts/sync-core.mjs
supabase db push                                     # only if there are new migrations
supabase functions deploy extract fetch-posting verify-company reword --no-verify-jwt
```

Then re-publish `web/` on your static host.

## Troubleshooting

- `Invalid JWT` / 401 from a function: you deployed without `--no-verify-jwt`, or the
  `Authorization: Bearer <anon key>` header is missing.
- Function returns `mode: "rules"` with a note mentioning the key: the secret is not set
  (`supabase secrets list`) or the key is invalid.
- `Cannot find module ../_shared/core/...`: run `node scripts/sync-core.mjs` before deploying.
- Magic link opens a broken page: the Site URL / Redirect URLs (step 8) do not match where
  `web/` is hosted.
- 429 "Too many requests": the per-IP limit is 30 requests/minute per function; wait a minute.
