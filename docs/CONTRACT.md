# Shared contract (read before writing any code)

Repo: `honest-resume`. Zero-build, plain ES modules (`.js`) everywhere so the same core runs in the browser (`web/`) and in Deno (Supabase Edge Functions). No TypeScript in `core/` or `web/`, no bundler. JSDoc types are welcome.

Layout
- `core/` canonical pure engine (no DOM, no fetch, no Deno APIs). Copied by `scripts/sync-core.mjs` to `web/core/` and `supabase/functions/_shared/core/`. Import style inside core: relative `./x.js` only.
- `web/` static frontend (`index.html` + ES modules). Imports core as `./core/x.js`. Supabase JS via `https://esm.sh/@supabase/supabase-js@2`.
- `supabase/` migrations + edge functions (Deno, `.ts` allowed in functions only; they import core as `../_shared/core/x.js`).
- `tests/` node:test files for core (`npm test` = `node --test tests/`).

Spec = `docs/SPEC.md` (the v1.0 problem statement). Integrity rules in SPEC section 15 are law. Rules-only mode is the complete product; AI is optional.

## Profile (master profile) - JSON document, stored locally first, synced to Supabase `profiles.data` when opted in

```js
Profile = {
  version: 1,
  basics: { fullName, email, phone, city, country, headline, photoDataUrl /* optional, device only, never sent */ },
  education: [{ id, degree, branch, institution, yearOfStudy /*1-5*/, expectedGradYear, coursework: [string] }],
  marks: { cgpa: { value /*string|null*/, display: 'always'|'relevant'|'never' },
           twelfth: { value, display } },            // default display 'relevant'
  skills: [{ id, name, category: 'core'|'tool'|'programming'|'custom',
             level: 'have'|'have_ai'|'exposure'|'none'|null,   // null = not yet confirmed, never printed
             whereUsed: string /* private, required for have/have_ai */,
             exposureNote: string /* e.g. 'reading level', optional */ }],
  languages: [{ id, name, level: 'native'|'fluent'|'conversational'|null }],
  links: { linkedin, github, portfolio },            // strings or ''
  entries: [{ id, kind: 'experience'|'project', title, organization /* or 'Personal project' */, role,
              start /* 'YYYY-MM' */, end /* 'YYYY-MM' | 'present' */,
              bullets: [{ id, text }],               // 2-4, student's own words
              result: { text, evidence: { kind: 'none'|'link'|'certificate'|'number', value },
                        numberStatus: 'evidence'|'confirmed'|'unconfirmed', sourceNote } }],
  achievements: [{ id, name, date, detail }],
  extracurriculars: [{ id, name, date, detail }],
  hobbies: [{ id, name, detail }],
  work: { preference: 'remote'|'in_office'|'hybrid'|'none', hoursPerWeek, startDate },
  aboutMe: string,
  settings: { pageSize: 'A4'|'Letter', aiEnabled: false, syncEnabled: false }
}
```
`core/schema.js` exports `newProfile()`, `migrateProfile(obj)`, `validateProfile(p) -> {ok, errors:[]}`, `newId()`.

## Tailoring session

```js
Session = {
  id, createdAt,
  role: { company, title, jdText, jdUrl,
          source: 'company_site'|'job_portal'|'linkedin'|'college'|'referral'|'telegram_whatsapp'|'email_dm'|'other',
          orgType, industry, note },
  companyCheck: { status: 'found'|'multiple'|'could_not_confirm'|'not_checked', matches: [{name, domain, source}], chosen, note },
  extraction: Extraction,                       // see below, editable by student
  family: { primary: FamilyId, secondary: FamilyId|null },
  confirmations: [{ reqId, skillId /* profile skill id or overlay skill id */, level, whereUsed, aiAssisted, saveToProfile: true|false }],
  overlay: { skills: [Skill] },                 // 'only for this resume' skills; never written to profile
  selection: { entryIds: [], achievementIds: [], extracurricularIds: [], hobbyIds: [], includeAboutMe: bool, aboutMeText },
  linkOverrides: { linkedin: null|true|false, github: null|true|false, portfolio: null|true|false },   // null = rule decides
  bulletEdits: { [bulletId]: text },            // student edits, still traced to bulletId
  numberConfirmations: { [bulletId]: { confirmed: true, sourceNote } },
  template: { id: 'text_first'|'text_accent'|'two_column'|'two_column_photo', columns:1|2, graphics:'none'|'light'|'photo', colour:'neutral'|'accent' },
  approval: { approved: false, snapshotHash: null, approvedAt: null }
}
FamilyId = 'editing_video'|'design'|'software_web'|'content_writing'|'operations_events'|'general'
```

```js
Extraction = {
  requirements: [{ id, text /* as written */, canonicalSkill /* matched catalog name or null */, priority: 'must'|'nice'|'unknown' }],
  workMode: 'remote'|'in_office'|'hybrid'|null, location, duration, stipend,
  educationMentioned: { degree, year, cgpa, coursework } /* booleans */,
  linksRequested: { github: bool, portfolio: bool, linkedin: bool },
  designToolsMentioned: bool,
  feeWarning: bool,                               // posting asks for payment
  unreadable: [string],                           // what could not be parsed
  suggestedFamily: { primary, secondary, reason }
}
```
`core/extract.js` exports `extractFromText({ title, jdText }) -> Extraction` (rules-only) and `suggestFamily(title, jdText) -> {primary, secondary, reason}`.

## Resume model (what gets rendered) - every line carries a source

```js
ResumeModel = {
  pageSize, template, family,
  header: { name, contactLine: [{text, src}], links: [{label, url, src}], photoDataUrl|null },
  sections: [{ key: 'about'|'skills'|'experience'|'projects'|'education'|'achievements'|'extracurriculars'|'hobbies'|'languages',
               title, items: [Item] }],
  trims: [{ step, what, reason }],               // shown in "Changes to fit one page"
  warnings: [string]
}
Item = { id, src: SourceRef, heading, sub, dateRange, lines: [{ id, text, src }] }
SourceRef = { type: 'basics'|'education'|'skill'|'language'|'link'|'entry'|'bullet'|'achievement'|'extracurricular'|'hobby'|'about'|'work'|'marks', id }
```
`core/tailor.js` exports `buildResume(profile, session) -> ResumeModel` (deterministic, no AI).
`core/integrity.js` exports `checkIntegrity(model, profile, session) -> { ok, violations: [{ code, message, lineId }] }` with codes: NO_SOURCE, BANNED_WORD, UNCONFIRMED_NUMBER, EXPOSURE_IN_BULLET, RATING_GRAPHIC, UNCONFIRMED_SKILL, MISSING_VERB.
`core/fit.js` exports `TRIM_ORDER`, `applyNextTrim(model) -> { model, trim|null }` and `estimateLines(model) -> number` (character-based estimate; the browser does real measurement).
`core/match.js` exports `buildMatchSummary(profile, session, model) -> { requirements: [{text, status:'met'|'partial'|'not_met', via}], workModeFit, verification, interviewPrep: [string], sparse: bool }`.
`core/filename.js` exports `resumeFileName(profile, session) -> 'Firstname-Lastname-Company-Role.pdf'`.
`core/data.js` exports `VERBS` (grouped + flat), `SKILL_CATALOG` (name, category, aliases[]), `FAMILIES` (id, label, titles[], keywords[], order[], education:'compact'|'normal'|'prominent', links[]), `ORG_TYPES`, `INDUSTRIES`, `HOBBY_EXAMPLES`, `FIELD_HELPERS`, `ATS_CHECKLIST`, `BANNED_LEVEL_WORDS`, `TEMPLATES`, `SOURCES`, `FILLER_HOBBIES`.
`core/ai-guard.js` exports `validateAiExtraction(raw, jdText) -> Extraction|null`, `validateReword(original, reworded, {confirmedSkills}) -> { ok, text, reasons }` (reject new numbers, banned words, new tool names not in confirmed skills, missing leading verb, >110 chars).
`core/hash.js` exports `async snapshotHash(model, template) -> hex string` using WebCrypto (`globalThis.crypto.subtle`, available in browser, Deno and Node 20+).

## Edge function HTTP contracts (all POST JSON, CORS enabled, `Authorization: Bearer <anon or user jwt>`)
- `extract` body `{ title, jdText, useAI? }` -> `{ extraction, mode: 'rules'|'ai+rules' }`
- `fetch-posting` body `{ url }` -> `{ ok: true, text, title? }` or `{ ok: false, reason: 'dead'|'login'|'paywall'|'expired'|'no_description'|'blocked', message }`
- `verify-company` body `{ name }` -> `{ status, matches: [{ name, domain, source }], note }`
- `reword` body `{ bullets: [{ id, text }], confirmedSkills: [string], family }` -> `{ bullets: [{ id, text, ok, reasons }], mode }` (ok=false means original kept)

Secrets: `ANTHROPIC_API_KEY` (optional; absence -> rules mode). Model `claude-opus-5-5`, raw fetch to `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`; structured output via `output_config: { format: { type: 'json_schema', schema } }`; `max_tokens: 4096`; do not send a `thinking` parameter. Never send contact details or photo to the AI: callers must strip them; the function also strips any email/phone regex matches defensively.

## DB (Supabase, RLS owner-only on auth.uid())
- `profiles(user_id uuid pk references auth.users, data jsonb, updated_at)`
- `snapshots(id uuid pk, user_id uuid, company text, role_title text, file_name text, template text, model jsonb, session jsonb, created_at)`
- `app_settings(user_id uuid pk, data jsonb)`
Local-first: the frontend keeps everything in localStorage under `hr.profile`, `hr.sessions`, `hr.snapshots`, `hr.settings`; sync is opt-in after sign-in (magic link).

## Non-negotiables for every agent
- Never print a skill with level null/none; 'exposure' only inside the Skills section as `Exposure: name (note)`; 'have_ai' grouped as `AI-assisted: ...`.
- Never auto-write a number; a bullet containing a digit whose entry has numberStatus 'unconfirmed' and no numberConfirmation is flagged UNCONFIRMED_NUMBER and the student edits it. The engine never rewrites student text silently.
- No PDF before approval; approval hash = sha-256 of JSON(model + template). Any edit invalidates.
- Mobile-first, tap-to-choose, every hover has a tap equivalent.

## Deviations (core engine, documented by the core agent)

All additive unless noted; nothing above was removed or renamed.

- **Extraction** gained `availabilityAsked: bool` (posting mentions hours per week / availability / start date / immediate joiner). `buildResume` prints the work-availability line only when it is true (SPEC 6.9).
- **ResumeModel**: `family` is the primary FamilyId string; `secondaryFamily` (FamilyId|null) added. `header.headline` added (basics.headline, may be ''). The availability line is a `header.contactLine` item with `src {type:'work', id:'work'}`.
- **Lines with several sources** (skills groups, hobbies, languages) carry `src` (first id, per contract) plus `srcs: [id, ...]` with every id; integrity checks every id in `srcs`.
- **Skills section** is one item `{id:'skills'}` with up to three lines: `skills-have`, `skills-ai` ("AI-assisted: ..."), `skills-exposure` ("Exposure: name (note), ...").
- **Result lines** have `id: \`${entryId}-result\``, `src {type:'entry', id: entryId}` and `kind:'result'`. Marks print as lines inside the first education item with `src {type:'marks', id:'cgpa'|'twelfth'}`.
- **numberConfirmations** may be keyed by bulletId *or* entryId; an entry-level confirmation covers its bullets and its result line.
- **Violations** carry `severity: 'block'|'warn'`. `MISSING_VERB` is `warn` and does not affect `ok`; all other codes are `block`.
- **fit.js**: trim records carry `kind` (one of `TRIM_ORDER`) and `itemId`/`lineId` where relevant, in addition to `{step, what, reason}`. Extra exports: `PAGE_LINE_BUDGET = {A4:52, Letter:50}`, `CHARS_PER_LINE = 95`, `fitToOnePage(model) -> {model, trims}`.
- **match.js**: requirement rows also carry `id`, `priority`, `canonicalSkill`; summary adds `missing` (not_met rows); `verification` adds `companyNote`, `sourceLabel`, `caution` next to `companyCheck`, `sourceUnverified`, `feeWarning`.
- **data.js**: `VERBS` is `{groups, flat, set}` (set = lowercase). `SKILL_CATALOG` entries carry `designTool` and `prefill` flags. Extra exports: `UNVERIFIED_SOURCE_CAUTION`, `SECTION_TITLES`, `STANDARD_SECTION_ORDER`, `INDIAN_CITIES`, `TRIM_ORDER` (also re-exported by fit.js), `findCatalogSkill(name)`, `familyById(id)`.
- **schema.js** extra exports: `newSession(role)`, `newSkill(name, category)`, `newEntry(kind)`, `PROFILE_VERSION`.
- **core/text.js** is an extra internal helper module (regex/date/format helpers), re-exported by `core/index.js`; `tailor.js` also exports `effectiveSkills`, `printableSkills`, `isPrintableSkill`, `isDesignTool`, `availabilityText`, `educationMode`, `sectionOrder`, `isSparseProfile`; `extract.js` exports the individual `detect*` helpers and `emptyExtraction()`.
- **validateAiExtraction** returns `null` only when the input is not an object; otherwise it always returns a full Extraction (ungrounded requirements dropped, capped at 40).
- **npm test** is `node --test tests/*.test.js`: on Node 24 the bare `node --test tests/` treats the directory as a file and fails. Fixtures live in `tests/_fixtures.js` (not a test file).
