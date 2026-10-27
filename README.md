# Resum.me

Resum.me is a free, open tool for first- and second-year students. It turns one set of true information (the master profile) into a one-page resume tailored to one role, plus a private match summary. Every printed line traces back to something the student confirmed. Nothing is inflated, nothing is padded, and no PDF exists until the student approves a specific snapshot.

The full product statement is in `docs/SPEC.md`. The loops found while building it, and how each was resolved, are in `docs/LOOPS.md`.

## What is in this repo

| Folder | What it is | Runs where |
|---|---|---|
| `core/` | The rules engine: extraction, tailoring, integrity checks, fit and trim, match summary, AI output guards. Pure JavaScript, no dependencies. | Browser and Supabase Edge Functions (copied by `npm run sync-core`) |
| `web/` | Static frontend. Plain HTML, CSS and ES modules. No build step. | Any static host (GitHub Pages, Netlify, Vercel) |
| `supabase/` | Database migration (profiles, snapshots, settings with row-level security) and four edge functions: `extract`, `fetch-posting`, `verify-company`, `reword`. | Supabase |
| `tests/` | Node tests for the core engine. | `npm test` |
| `docs/` | Spec, contract, loop analysis, deploy guide. | |

Rules-only mode is the complete product. The app works with an empty `web/config.js`: everything stays in the browser's local storage, extraction uses keyword rules, and the company check shows "Not checked". Filling in the Supabase URL and anon key adds link fetching, company checks, optional sign-in sync, and, if you set an `ANTHROPIC_API_KEY` secret on the project, optional AI extraction and rewording. AI output always passes through the same deterministic guards.

## Run locally

```
npm test            # core engine tests
npm run sync-core   # copy core/ into web/core and supabase/functions/_shared/core
npm run serve       # serves web/ on http://localhost:5173
```

Open the URL in a browser. Fill the Profile tab, then Tailor.

## Deploy

See `docs/DEPLOY.md` for the Supabase steps (database push, function deploy, secrets, auth) and for hosting `web/`.

## Integrity rules enforced in code

1. Only profile data at its confirmed level is printed. Unconfirmed skills never appear.
2. "AI-assisted" and "Exposure" labels are fixed wording. Banned level words are blocked.
3. Missing requirements go to the private summary, never the resume.
4. Numbers print only with evidence or an explicit confirmation plus a private source note.
5. Every line carries a source reference. A line without one blocks approval.
6. Company and posting checks state exactly what they did and did not verify.
7. No PDF before approval. Approval is a hash of the exact content and template; any change clears it.
8. Every trim made to fit one page is listed before approval.
9. No skill bars, dots, stars or percentages in any template.
