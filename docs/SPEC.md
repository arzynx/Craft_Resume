# Honest, Role-Targeted Resume Builder for Students

Version: 1.0 (final draft for build)
Project type: Free, open DIY tool for fellow students
Output: One-page tailored resume (PDF) plus a private match summary

## 1. Background

First- and second-year students apply for internships, part-time and remote gigs, freelance work, and campus clubs and societies. Most have one generic resume copied from a template and send it everywhere.

Different roles value different things:
- A video-editing role values DaVinci Resolve, colour grading, typography and a portfolio. It cares little about CGPA.
- A software role values web development, programming, leadership and GitHub. It cares little about design tools.
- An events or operations role values coordination, time management and club leadership.

One static resume fits none of them well. Students also run into four common problems: blank-field paralysis (Hobbies, About Me, Achievements), padding, inflation ("watched a tutorial" becomes "proficient"), and template confusion (photo-heavy multi-column templates marked "Recommended" with blanket ATS claims).

## 2. Problem

Students need a simple, guided way to turn one set of true information into a one-page resume tailored to a specific role. The resume should use concise, action-led wording (inspired by publicly available university career-office sample resumes such as the Harvard Extension School samples, no affiliation implied), contain only content the student can explain line by line in an interview, and show the student privately what the role asks for that they do not yet have.

## 3. Goals and non-goals

Goals: honest tailoring (every printed line traces back to confirmed profile data); role awareness (order, emphasis and links change by role); guidance (step-by-step assistant with tap-to-choose answers and helpers for confusing fields); template freedom with informed choice; student control (nothing is generated without explicit approval).

Non-goals (v1): cover letters, multi-page CVs, academic CVs; submitting applications or contacting recruiters; scoring or ranking students; teaching skills.

## 4. Scope

Opportunity types: internships (on-site, remote, hybrid), part-time and remote gigs, freelance pitches, campus clubs/societies/fests, volunteer coordinator roles.

Role families at launch:
| Role family | Typical titles |
|---|---|
| Editing and Video | Video editor, reels editor, motion graphics intern, colourist assistant |
| Design | Graphic designer, UI/UX intern, social media designer, thumbnail designer |
| Software and Web | Web developer intern, frontend intern, tech club member, app tester |
| Content and Writing | Content writer, copywriter, blog writer, scriptwriter, social media content |
| Operations and Events | Event coordinator, fest volunteer lead, operations intern, community manager |
| General (fallback) | Anything else |

Organization type (optional, tap-to-choose): Startup; Mid-size company; Large company or MNC; Agency (creative, marketing, digital); NGO or nonprofit; Government or PSU; Research lab or university department; Campus club, society or fest; Freelance client or individual; Content creator or YouTuber; Other.

Industry (optional, tap-to-choose): Technology and software; Media and entertainment; Marketing and advertising; Design and creative; Education and edtech; Finance and fintech; Healthcare; E-commerce and retail; Gaming; Nonprofit and social impact; Government and public sector; Events and hospitality; Other.

Role family drives content. Organization type and industry adjust tone and emphasis only and can never add content.

Terminology: master profile (single source of truth), role (title + description), company (context + subject of verification), tailored resume (one-page PDF from selected master-profile data for one role), snapshot (the exact content and template the student approved), private match summary (gap report for the student only). The product uses "resume" throughout; "CV" is not an output format.

## 5. Core idea

Stage 1: Master profile, built once, edited any time, holds true information plus private notes on where each skill was used and what evidence exists.

Stage 2: Tailoring. For each application the student enters company, role title and job description. The tool extracts requirements, compares them to the profile, asks only about what is new or conflicting, selects, orders and rewords confirmed data, reports gaps privately, shows a full preview, and generates the PDF only after explicit approval.

## 6. Master profile

### 6.1 Basics
| Field | Required | Notes |
|---|---|---|
| Full name | Yes | |
| Email | Yes | Tip: use a professional address, ideally firstname.lastname |
| Phone | Optional | Stored with country code |
| City | Optional | Country optional. Never ask for a full street address |
| Headline | Optional | One line, e.g. "B.Tech ECE student | Video editor" |
| Photo | Optional | Stored on the device only. Warning shown on upload (14.4). Used only by photo templates |

### 6.2 Education
Degree, branch, institution, year of study, expected graduation year. CGPA (optional) and 12th-grade marks (optional) stored separately, each with a display setting: Always / Only when relevant / Never (default: Only when relevant). Relevant coursework optional, up to 4 courses.

### 6.3 Skills
Every skill has: name; level (student-selected, required before it can appear); "Where I used it" (private one-line note, required for "Have this"). Valid sources include coursework, a personal practice project, a club task or self-learning; it does not have to be a formal Experience entry.

Prefilled categories: Core skills (teamwork and collaboration, time and event management, people coordination, communication, leadership, creativity); Tool skills (DaVinci Resolve, Figma, Canva, AI tools named specifically, others); Programming (HTML/CSS/JavaScript, C/C++, Python, others).

| Level | Printed as | Example |
|---|---|---|
| Have this | Skill name | DaVinci Resolve |
| Have this, AI-assisted | Grouped under an AI-assisted label | Web (AI-assisted): HTML, CSS, JavaScript |
| Some exposure | Grouped under "Exposure" | Exposure: Python (reading level) |
| Don't have this | Never printed | |

Rules: "AI-assisted" and "reading level" labels are kept exactly. Never upgraded to "proficient", "expert", "advanced" or similar. Interpersonal skills need a private example; printed in Skills only if an example exists; wherever possible shown through a bullet instead. "Where I used it" notes are never printed.

### 6.4 Languages (spoken)
English and Hindi prefilled and editable. Levels: Native / Fluent / Conversational. Printed only when confirmed, as "English (Fluent), Hindi (Native)".

### 6.5 Links
| Link | Default visibility |
|---|---|
| LinkedIn | Every version, if present |
| GitHub | Software and Web, if present |
| Portfolio (Drive, YouTube, Behance, personal site) | Editing and Video, Design, Content and Writing, if present |

Posting override: if the job description explicitly asks for a link the student has, show it regardless of family. Manual override: the student can turn any link on or off in preview. Missing links are omitted silently; no placeholders; never ask the student to create an account during tailoring. Drive links get a reminder to set sharing to "Anyone with the link can view".

### 6.6 Experience and projects
Each entry: title; organization or "Personal project"; the student's role; start and end month (or Present); two to four things the student actually did; optional result with optional evidence (number, link, certificate); an evidence status for any number: Evidence attached / Student-confirmed / Unconfirmed. Entries are held back by default and included only when selected for a role. Unconfirmed numbers are never printed.

### 6.7 Achievements and extracurriculars
Both optional. Each entry: short name, optional date, optional one-line detail. Volunteering belongs under Extracurriculars, or under Experience if structured recurring work. Never a hobby.

### 6.8 Hobbies
Optional, up to 4, 2 recommended. Helper in Section 12.

### 6.9 Work preference and availability
Preference: Remote / In-office / Hybrid / No preference. Availability: hours per week and optional start date. Printed only when the posting asks about them. The role's work mode (extracted) is stored separately; a mismatch appears in the private match summary only.

## 7. Guided tailoring flow

One screen at a time, progress bar, suggested next step, approval never skipped. Tap-to-choose wherever possible. Each profile screen shows 2-3 short contextual tips (side card on desktop, collapsible card on mobile).

Step 1: Role input. Company or organization name (required); Role title (required); Job description (one box: paste text or paste a link); "Where did you find this posting?" (Company website / Job portal / LinkedIn / College or placement cell / Referral / Telegram or WhatsApp / Email or DM / Other); Organization type and industry (optional); "Anything else about this company?" (optional, not treated as verification). If a link is dead, behind a login or paywall, expired, or has no usable description, say so plainly and ask for pasted text.

Step 2: Verification and extraction review. Show company check result (Section 8); suggested role family (confirm or change with a tap; mixed roles get a primary and an optional secondary family); extracted requirements split into Must-have and Nice-to-have where clear; extracted work mode, location, duration and stipend (private summary only); anything that could not be read or verified. The student can correct, remove or add requirements.

Step 3: Skill confirmation (only new or conflicting items). Requirements already in the profile are shown as "Already in your profile, [level]" with a Change option. For each requirement not in the profile: Have this / Some exposure / Don't have this. Choosing Have this or Some exposure opens a mini-form: level, AI-assisted yes/no, "Where I used it". Then: "Save this to your master profile?" (Yes / Only for this resume).

Step 4: Content selection. Tap to choose experiences, projects, achievements, extracurriculars and hobbies. The tool can recommend items and an order with a reason ("Matches 'event coordination' in the posting"). It never adds anything not selected.

Step 5: Preview and template. Live one-page preview with the chosen template; every bullet editable; tapping a line shows its source entry; a "Changes to fit one page" panel; the private match summary beside the preview; template filters and the ATS popup (Section 14).

Step 6: Approval. Button "Approve and generate PDF". No PDF rendered or saved before this point. Approval locks a snapshot; any later edit or template change requires approving again.

## 8. Company and posting checks

The check confirms only whether an organization with that name appears to exist (official website, public registry, well-known listing). It does not confirm the posting is genuine or current, or that a recruiter is authorized.

| Result | Meaning |
|---|---|
| Company found | A matching organization appears to exist (source shown) |
| Multiple matches, pick one | Student taps the correct one |
| Could not confirm | Nothing reliable found. Tailoring continues |
| Not checked | Offline or rules-only mode |

Campus clubs, freelance clients and individuals: verify what can be checked and state what could not be confirmed. Postings from Telegram, WhatsApp, email or DM are labelled "Unverified source" with the caution "Never pay a fee to apply. Verify the company independently before sharing documents." The student is informed, not blocked.

## 9. AI role and boundaries

The tool must work fully without AI (rules-only mode). AI may: extract requirements, work mode and keywords; suggest a role family; suggest section and entry order; reword the student's own bullet text into action-verb style; draft an About Me using only confirmed fields, labelled as a draft; suggest the next step. AI may not: add facts, skills, numbers, tools, dates or organizations; change a skill level or remove an "AI-assisted" or "reading level" label; put "Some exposure" skills inside bullets; override any integrity rule.

Enforcement: deterministic checks run after every AI output. Lines without a source are blocked, banned level words are flagged, unconfirmed numbers are stripped. Only the job description and selected profile excerpts are sent to the AI provider; contact details and the photo are never sent. First-use disclosure: "AI features send your job description and selected resume text to [provider]. Use rules-only mode to keep everything on your device."

Rules-only mode uses keyword matching against the profile, fixed role-family ordering and a fixed verb list.

## 10. Role-based tailoring rules

| Role family | Section order (after header) | Education | Header links |
|---|---|---|---|
| Editing and Video | Skills and tools, Projects/portfolio work, Experience, Extracurriculars | Compact | Portfolio |
| Design | Skills and tools, Projects/portfolio work, Experience, Extracurriculars | Compact | Portfolio |
| Software and Web | Skills (programming first), Projects, Experience and leadership, Extracurriculars | Normal | GitHub |
| Content and Writing | About Me (if any), writing samples/projects, communication skills, Extracurriculars | Compact | Portfolio |
| Operations and Events | Experience and club roles, core skills, Achievements | Normal | LinkedIn only |
| General | Education, core skills, other selected content | Prominent | LinkedIn only |

LinkedIn appears on every family if present. Education is prominent whenever the posting mentions a degree, year of study, CGPA or coursework. CGPA and 12th marks follow their display setting; "Only when relevant" means shown when the posting asks for marks or when the family is General. Design tools on software roles are omitted unless the posting mentions them. Secondary family: primary sets the order; secondary can pull in one extra relevant section or link.

## 11. Resume writing rules

Every bullet starts with an action verb from the approved list, uses no personal pronouns, contains one idea, stays within two lines (about 110 characters). 2-4 bullets per entry. Numbers only with evidence or explicit confirmation; approximate figures marked as "about" or a true lower bound ("50+"). Job-description keywords mirrored in bullets only for "Have this" skills; "Some exposure" skills appear only in the Skills list with their label. Skills: short grouped list, no descriptions, no ratings, bars or stars. About Me optional, 2-3 lines (about 300 characters), only if the student writes or approves it. One consistent date format ("Jan 2025 - Present"). Standard headings: About Me, Skills, Experience, Projects, Education, Achievements, Extracurriculars, Hobbies, Languages. Never add facts, change levels or imply more experience.

## 12. Field helpers

### 12.1 Hobby helper
Label "Hobbies (optional, up to 4, 2 recommended)". Definition: "A hobby is a regular, hands-on activity you choose to do in your free time for fun or relaxation." Primary trigger: visible "See examples" tap target. Secondary (desktop): reveal after about 1.5 s hover.

| Hobby | What it can show (guidance only, never printed) |
|---|---|
| Reading | Love of learning, focus |
| Writing or blogging | Clear communication, organized thinking |
| Team sports (football, cricket, basketball) | Teamwork, discipline, cooperation |
| Yoga or meditation | Patience, stress management |
| Language learning | Curiosity, willingness to grow |
| Photography or painting | Creativity, attention to detail |
| Chess or puzzles | Strategic thinking, problem-solving |
| Cooking | Experimenting, planning |
| Cycling or trekking | Endurance, consistency |
| Gaming (with a detail, e.g. "strategy games") | Strategy, quick decisions |

Tips: keep it short (2-4); add a tiny detail ("Cooking (trying regional recipes)"); be honest; skip fillers ("listening to music", "watching TV", "hanging out with friends"). Behaviours: filler -> soft suggestion; volunteering -> offer to move to Extracurriculars; more than 4 -> pick up to 4 for the resume, others stay in the profile.

### 12.2 Other fields
Achievements: "Something you were recognized for or completed with a clear outcome." Examples: competition placement, certificate, scholarship, selection into a program. Extracurriculars: "Organized activities outside class." Examples: club member or lead, fest volunteer, NSS/NCC, sports team, community volunteering. About Me: fill-in-the-blank structures, e.g. "[Year] [degree] student with hands-on experience in [confirmed skill], seeking [role type] where I can [what you'll contribute]."

## 13. Output

### 13.1 The resume
One-page PDF, A4 (default) or Letter. Sections only with real, relevant, selected content, ordered by family: Header, About Me, Skills, Experience, Projects, Education, Achievements, Extracurriculars, Hobbies, Languages. Fit rules: trim, never pad; body at least 10.5 pt everywhere, sidebar at least 10 pt; margins at least 0.6 in; white space under sparse content acceptable. Trim order when content overflows: Hobbies; Languages; lowest-ranked extracurricular; third and fourth bullets on lower-ranked entries; About Me. Every trim is shown and approved. Technical: selectable text layer, no text as images; embedded standard fonts; logical reading order even in two columns; contact details in the body, not the PDF header/footer area; icons always paired with text. File name: Firstname-Lastname-Company-Role.pdf, editable.

### 13.2 Private match summary (never part of the resume)
Requirements marked Met / Partly met (exposure) / Not met; work-mode fit; verification result plus "Unverified source" flag; interview prep note (lines most likely to be asked about, e.g. AI-assisted skills and numbers). Viewable in app and optionally saved as a separate file marked "Private, do not send".

### 13.3 Saved versions
Each approved snapshot saved locally with company, role, date, template and file name. Snapshots can be duplicated to start a similar role.

## 14. Templates and ATS guidance

14.1 Filters: Columns one/two; Graphics none/light/photo; Colour neutral/accent.

14.2 "Recommended" goes only to single-column, text-first, no photo, neutral, standard fonts. Photo, two-column and coloured-sidebar templates remain available, labelled "Use with care". Never claim "ATS-friendly" or "guaranteed to pass". No template includes skill bars, dots, stars or percentage ratings.

14.3 ATS checklist (shared by popup and rules page): single-column for online portals; avoid photos unless the country or employer expects them; avoid tables, text boxes and multi-column layouts; standard headings; standard fonts, body 10.5 pt or larger; contact details in the main body; no important text inside images or icons; no skill bars or ratings; one consistent date format; text-based PDF, not a scan; posting keywords only for skills you genuinely have; clear file name.

14.4 Warning popup. Triggers: choosing a Photo, Two-column or Accent-sidebar template; uploading a photo (shorter version). Once per session per trigger type, non-blocking, "Don't show again" available. Content: "Before you use this template" - photos and multi-column or graphic layouts may be read incorrectly by some applicant tracking systems; photo conventions vary (discouraged in many contexts, can introduce bias, expected in some countries and roles); for online portals a text-first resume is the safer choice, a visual version can suit design or editing applications sent directly to a person. Buttons: See full comparison / Use text-first instead / Continue with this template.

14.5 Rules and comparison page. Two thumbnails side by side with the same content (text-first single-column no photo vs visual two-column with photo). Comparison table:
| Aspect | Text-first | Visual / photo |
|---|---|---|
| ATS parsing | Generally reliable | May misread columns, sidebars and icons |
| Human skim-reading | Clean, predictable | Eye-catching, shows design sense |
| Best for | Online portals, software, general, operations | Direct email to a designer, editor or creative lead |
| Risks | Can look plain | Parsing errors, photo bias, wasted space |
| Photo convention | Not needed | Expected in some countries, discouraged in others |
| Printing | Clean | Colour blocks may print poorly |
| Honest-level display | Text labels | Must still use text labels, never bars |
Bottom: the full ATS checklist. No absolute rule against photos.

## 15. Integrity rules (non-negotiable)
1. Print only information from the master profile, at its confirmed level.
2. Keep "AI-assisted" and "reading level" labels exactly. Never generate "proficient", "expert", "advanced" or similar.
3. Report missing requirements in the private summary. Never add them to the resume.
4. Print numbers only with evidence or explicit student confirmation.
5. Every printed line must trace to a source entry. Lines without a source are blocked.
6. State exactly what the company and posting checks did and did not verify.
7. Generate no PDF before explicit approval. Any change after approval requires approving again.
8. Show every trim or omission made to fit one page before approval.
9. Never display skill ratings, bars or percentages.

## 16. Edge cases
| Situation | Behaviour |
|---|---|
| No LinkedIn, GitHub or portfolio | Omit silently, no placeholder |
| No experience and no projects | Omit Experience. Suggest once that a genuine course project or extracurricular may be included |
| Sparse profile (fewer than 2 entries across Experience, Projects, Extracurriculars, Achievements) | Accept a half-page resume; say it is fine; show which fields could genuinely add detail |
| Unreadable job link | Explain why; show a clearly labelled paste-text box |
| Company not found | Continue with "Could not confirm" |
| Posting asks for skills the student lacks | Not met in the private summary; nothing added |
| Skill level changed during tailoring | Ask: update master profile or this resume only |
| New skill added during tailoring | Mini-form (level + where used), then ask whether to save to profile |
| Edits after approval | Snapshot unlocked; approval required again |
| Role fits two families | Pick primary, optional secondary |
| Photo template for a portal application | Show popup; respect the choice |
| First-year with no CGPA | Hide CGPA; offer 12th marks |
| AI unavailable or rules-only | Full flow with simpler wording; verification shows "Not checked" |
| Telegram/WhatsApp posting asking for a fee | "Unverified source" flag and "Never pay a fee to apply" |

## 17. Privacy and data handling
Master profile, photo and snapshots stored on the device by default; account sync optional and opt-in. AI and verification calls send only the data in Section 9; contact details and photo never sent. View, edit, export and import profile JSON any time. Delete profile, photo and app-stored PDFs any time; downloaded copies remain under the student's control. Pasted job descriptions kept only for the session unless the tailored version is saved. No sharing with employers, job boards, advertisers or third parties. No analytics on profile content; any usage analytics anonymous and opt-in.

## 18. Interaction and accessibility
Mobile-first; every hover has a tap equivalent. Tap-to-choose with free text fallback. Progress bar with step names and a back button that never loses data. Autosave of profile and in-progress tailoring. Readable contrast, scalable text, keyboard navigation, screen-reader labels. Plain-language microcopy; write "applicant tracking system (ATS)" in full the first time.

## 19. Success criteria
After completing the master profile, a student enters company, role and job description and in one guided session of under 10 minutes receives: a one-page role-specific PDF where every line traces to a confirmed entry; a private summary of met, partly met and missing requirements; a clear statement of what was and was not verified; content they can explain line by line. Measurable: zero printed lines without a source; zero banned level words on AI-assisted or exposure skills; PDF text selectable and copyable in reading order. Profile setup target: 20 minutes or less.

## 20. Resolved decisions
| Decision | Final outcome |
|---|---|
| CGPA and 12th marks default | "Only when relevant". CGPA hidden until it exists. After 2nd year, suggest switching 12th marks to "Never" |
| Action-verb list | Fixed curated list of about 60 verbs grouped by category (Coordination, Creative, Technical, Communication, Teamwork, Improvement). AI and rules engine use only this list |
| Bullet length | One idea, at most two lines (about 110 characters), 2-4 bullets per entry |
| About Me | Blank by default; fill-in-the-blank structure or labelled draft from confirmed fields; student must edit or approve |
| Sparse-profile trigger | Fewer than 2 entries across Experience, Projects, Extracurriculars and Achievements |
| Number confirmation without evidence | Student taps "I can explain how I got this number" and adds a private one-line source note. Without both, not printed |
| Skills wording | Have this -> name; AI-assisted -> grouped label; Exposure -> grouped "Exposure:" line |
| Hover delay | About 1.5 s on desktop; primary trigger is always the tap target |
| Photo templates | Allowed, "Use with care", never "Recommended", always preceded by the popup |
| Default page size | A4, switchable to Letter |
| AI dependency | Optional. Rules-only mode is a complete product |

## 21. Deferred
Additional role families (Marketing and Social Media, Sales and BD, Teaching and Tutoring, Research Assistant); Hindi interface; cover letter generator; shareable profile link; interview-prep questions.
