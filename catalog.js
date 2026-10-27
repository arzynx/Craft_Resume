// Adapters over ./core/data.js so views can rely on one normalized shape
// regardless of whether the core exports arrays of strings, arrays of
// objects or keyed maps. Falls back to spec-defined values where an export
// is missing, so the UI never crashes on a thin core.
import * as D from './core/data.js';

export const data = D;

/** Normalize to [{ value, label, ...original }]. */
export function asOptions(x, { idKey = 'id', labelKey = 'label' } = {}) {
  if (!x) return [];
  if (Array.isArray(x)) {
    return x.map((o) => {
      if (typeof o === 'string') return { value: o, label: o };
      const value = o[idKey] ?? o.value ?? o.key ?? o.name ?? o.label;
      const label = o[labelKey] ?? o.name ?? o.title ?? o.text ?? String(value);
      return { ...o, value, label };
    });
  }
  if (typeof x === 'object') {
    return Object.entries(x).map(([k, v]) => {
      if (typeof v === 'string') return { value: k, label: v };
      if (Array.isArray(v)) return { value: k, label: k, items: v };
      return { ...v, value: v?.[idKey] ?? k, label: v?.[labelKey] ?? v?.name ?? v?.title ?? k };
    });
  }
  return [];
}

export function labelOf(options, value, fallback = '') {
  const o = options.find((x) => x.value === value);
  return o ? o.label : (fallback || (value ?? ''));
}

const SOURCE_FALLBACK = [
  ['company_site', 'Company website'], ['job_portal', 'Job portal'], ['linkedin', 'LinkedIn'],
  ['college', 'College or placement cell'], ['referral', 'Referral'], ['telegram_whatsapp', 'Telegram or WhatsApp'],
  ['email_dm', 'Email or DM'], ['other', 'Other']
].map(([value, label]) => ({ value, label }));

const FAMILY_FALLBACK = [
  ['editing_video', 'Editing and Video'], ['design', 'Design'], ['software_web', 'Software and Web'],
  ['content_writing', 'Content and Writing'], ['operations_events', 'Operations and Events'], ['general', 'General']
].map(([value, label]) => ({ value, label }));

const ORG_FALLBACK = ['Startup', 'Mid-size company', 'Large company or MNC', 'Agency (creative, marketing, digital)',
  'NGO or nonprofit', 'Government or PSU', 'Research lab or university department', 'Campus club, society or fest',
  'Freelance client or individual', 'Content creator or YouTuber', 'Other'];
const INDUSTRY_FALLBACK = ['Technology and software', 'Media and entertainment', 'Marketing and advertising', 'Design and creative',
  'Education and edtech', 'Finance and fintech', 'Healthcare', 'E-commerce and retail', 'Gaming', 'Nonprofit and social impact',
  'Government and public sector', 'Events and hospitality', 'Other'];

const TEMPLATE_FALLBACK = [
  { id: 'text_first', label: 'Text-first', columns: 1, graphics: 'none', colour: 'neutral' },
  { id: 'text_accent', label: 'Text with accent headings', columns: 1, graphics: 'none', colour: 'accent' },
  { id: 'two_column', label: 'Two-column sidebar', columns: 2, graphics: 'light', colour: 'accent' },
  { id: 'two_column_photo', label: 'Two-column with photo', columns: 2, graphics: 'photo', colour: 'accent' }
];

const ATS_FALLBACK = [
  'Single-column layout for online portals',
  'Avoid photos unless the country or employer expects them',
  'Avoid tables, text boxes and multi-column layouts',
  'Standard headings (Skills, Experience, Projects, Education...)',
  'Standard fonts, body 10.5 pt or larger',
  'Contact details in the main body, not the header or footer area',
  'No important text inside images or icons',
  'No skill bars or ratings',
  'One consistent date format',
  'Text-based PDF, not a scan',
  'Posting keywords only for skills you genuinely have',
  'Clear file name (Firstname-Lastname-Company-Role.pdf)'
];

const HOBBY_FALLBACK = [
  ['Reading', 'Love of learning, focus'], ['Writing or blogging', 'Clear communication, organized thinking'],
  ['Team sports (football, cricket, basketball)', 'Teamwork, discipline, cooperation'], ['Yoga or meditation', 'Patience, stress management'],
  ['Language learning', 'Curiosity, willingness to grow'], ['Photography or painting', 'Creativity, attention to detail'],
  ['Chess or puzzles', 'Strategic thinking, problem-solving'], ['Cooking', 'Experimenting, planning'],
  ['Cycling or trekking', 'Endurance, consistency'], ['Gaming (with a detail, e.g. "strategy games")', 'Strategy, quick decisions']
].map(([name, shows]) => ({ name, shows }));

const FILLER_FALLBACK = ['listening to music', 'watching tv', 'watching movies', 'hanging out with friends', 'sleeping', 'browsing', 'scrolling'];

export const SOURCES = asOptions(D.SOURCES).length ? asOptions(D.SOURCES) : SOURCE_FALLBACK;
export const ORG_TYPES = asOptions(D.ORG_TYPES).length ? asOptions(D.ORG_TYPES) : asOptions(ORG_FALLBACK);
export const INDUSTRIES = asOptions(D.INDUSTRIES).length ? asOptions(D.INDUSTRIES) : asOptions(INDUSTRY_FALLBACK);
export const FAMILIES = asOptions(D.FAMILIES).length ? asOptions(D.FAMILIES) : FAMILY_FALLBACK;
export const ATS_CHECKLIST = Array.isArray(D.ATS_CHECKLIST) && D.ATS_CHECKLIST.length
  ? D.ATS_CHECKLIST.map((x) => (typeof x === 'string' ? x : x.text ?? x.label ?? String(x)))
  : ATS_FALLBACK;
export const FILLER_HOBBIES = Array.isArray(D.FILLER_HOBBIES) && D.FILLER_HOBBIES.length
  ? D.FILLER_HOBBIES.map((x) => String(typeof x === 'string' ? x : x.name ?? x).toLowerCase())
  : FILLER_FALLBACK;
export const BANNED_LEVEL_WORDS = Array.isArray(D.BANNED_LEVEL_WORDS) ? D.BANNED_LEVEL_WORDS : ['proficient', 'expert', 'advanced', 'mastery', 'ninja', 'guru'];

export const HOBBY_EXAMPLES = (() => {
  const raw = D.HOBBY_EXAMPLES;
  if (!raw) return HOBBY_FALLBACK;
  if (Array.isArray(raw)) {
    const out = raw.map((x) => {
      if (typeof x === 'string') return { name: x, shows: '' };
      if (Array.isArray(x)) return { name: x[0], shows: x[1] ?? '' };
      return { name: x.name ?? x.hobby ?? x.label ?? '', shows: x.shows ?? x.what ?? x.signal ?? x.detail ?? '' };
    });
    return out.length ? out : HOBBY_FALLBACK;
  }
  if (typeof raw === 'object') return Object.entries(raw).map(([name, shows]) => ({ name, shows: typeof shows === 'string' ? shows : '' }));
  return HOBBY_FALLBACK;
})();

/** Templates with derived flags: recommended only for text_first; the rest "Use with care". */
export const TEMPLATES = (() => {
  const raw = asOptions(D.TEMPLATES);
  const base = raw.length ? raw : asOptions(TEMPLATE_FALLBACK);
  return base.map((t) => {
    const fb = TEMPLATE_FALLBACK.find((f) => f.id === t.value) || {};
    const id = t.id ?? t.value;
    const columns = t.columns ?? fb.columns ?? 1;
    const graphics = t.graphics ?? fb.graphics ?? 'none';
    const colour = t.colour ?? t.color ?? fb.colour ?? 'neutral';
    const trigger = graphics === 'photo' ? 'photo' : columns === 2 ? 'two_column' : null;
    return { ...t, id, value: id, label: t.label ?? fb.label ?? id, columns, graphics, colour,
      recommended: id === 'text_first', care: id !== 'text_first', trigger };
  });
})();

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

/** Flat verb list and grouped verbs. VERBS may be { grouped, flat }, { groups, all }, a map or an array. */
export const VERB_GROUPS = (() => {
  const v = D.VERBS;
  if (!v) return {};
  if (Array.isArray(v)) return { Verbs: v };
  const g = v.grouped ?? v.groups ?? v.byCategory ?? v.categories;
  if (g && typeof g === 'object' && !Array.isArray(g)) return g;
  if (Array.isArray(g)) return Object.fromEntries(g.map((x) => [x.label ?? x.name ?? x.id, x.verbs ?? x.items ?? []]));
  const out = {};
  for (const [k, val] of Object.entries(v)) if (Array.isArray(val) && k !== 'flat' && k !== 'all') out[k] = val;
  return out;
})();
export const VERBS_FLAT = (() => {
  const v = D.VERBS;
  if (!v) return [];
  if (Array.isArray(v)) return v.slice();
  if (Array.isArray(v.flat)) return v.flat.slice();
  if (Array.isArray(v.all)) return v.all.slice();
  return Object.values(VERB_GROUPS).flat();
})();

/** Skill catalog normalized to [{ name, category, aliases: [] }]. */
export const SKILL_CATALOG = (() => {
  const raw = D.SKILL_CATALOG;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([name, v]) => ({ name, ...(typeof v === 'object' ? v : { category: v }) }));
  return list.map((s) => (typeof s === 'string' ? { name: s, category: 'custom', aliases: [] }
    : { name: s.name ?? s.label ?? '', category: s.category ?? 'custom', aliases: Array.isArray(s.aliases) ? s.aliases : [] }));
})();

/** Find a catalog entry by name or alias (case-insensitive). */
export function catalogLookup(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  return SKILL_CATALOG.find((s) => s.name.toLowerCase() === n || s.aliases.some((a) => String(a).toLowerCase() === n)) || null;
}

/** True when two skill names refer to the same skill (direct or via catalog aliases). */
export function sameSkill(a, b) {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const cx = catalogLookup(x); const cy = catalogLookup(y);
  return Boolean(cx && cy && cx.name === cy.name);
}

const HELPER_FALLBACK = {
  hobbies: {
    label: 'Hobbies (optional, up to 4, 2 recommended)',
    definition: 'A hobby is a regular, hands-on activity you choose to do in your free time for fun or relaxation.',
    tips: ['Keep it short (2-4).', 'Add a tiny detail: "Cooking (trying regional recipes)".', 'Be honest.',
      'Skip fillers like "listening to music", "watching TV" or "hanging out with friends".']
  },
  achievements: {
    definition: 'Something you were recognized for or completed with a clear outcome.',
    examples: ['Competition placement', 'Certificate', 'Scholarship', 'Selection into a program']
  },
  extracurriculars: {
    definition: 'Organized activities outside class.',
    examples: ['Club member or lead', 'Fest volunteer', 'NSS / NCC', 'Sports team', 'Community volunteering']
  },
  aboutMe: {
    definition: 'Optional, 2-3 lines (about 300 characters). Only printed if you write or approve it.',
    structures: ['[Year] [degree] student with hands-on experience in [confirmed skill], seeking [role type] where I can [what you will contribute].',
      '[Degree] student who [what you do regularly], looking for [role type] to [contribution].']
  },
  skills: {
    definition: 'Every skill needs a level you chose and a private note on where you used it. Coursework, a practice project, a club task or self-learning all count.'
  },
  entries: {
    definition: 'Two to four things you actually did, each starting with an action verb, one idea each, about 110 characters.'
  }
};

/**
 * FIELD_HELPERS adapter. Returns { label, definition, examples[], tips[], structures[] }
 * from whatever shape the core uses (string or object with similar keys).
 */
export function helperFor(key) {
  const fb = HELPER_FALLBACK[key] || {};
  const raw = D.FIELD_HELPERS ? (D.FIELD_HELPERS[key] ?? D.FIELD_HELPERS[key?.toLowerCase?.()]) : null;
  const out = { label: fb.label || '', definition: fb.definition || '', examples: fb.examples || [], tips: fb.tips || [], structures: fb.structures || [] };
  if (!raw) return out;
  if (typeof raw === 'string') { out.definition = raw; return out; }
  if (Array.isArray(raw)) { out.examples = raw.map(String); return out; }
  out.label = raw.label ?? raw.title ?? out.label;
  out.definition = raw.definition ?? raw.description ?? raw.text ?? raw.help ?? out.definition;
  const ex = raw.examples ?? raw.items ?? raw.list;
  if (Array.isArray(ex)) out.examples = ex.map((e) => (typeof e === 'string' ? e : e.text ?? e.name ?? e.label ?? String(e)));
  if (Array.isArray(raw.tips)) out.tips = raw.tips.map(String);
  const st = raw.structures ?? raw.templates ?? raw.fillIn ?? raw.patterns;
  if (Array.isArray(st)) out.structures = st.map(String);
  return out;
}

export const LEVELS = [
  { value: 'have', label: 'Have this' },
  { value: 'have_ai', label: 'Have this, AI-assisted' },
  { value: 'exposure', label: 'Some exposure' },
  { value: 'none', label: "Don't have this" }
];
export function levelLabel(level) {
  if (level == null) return 'Not confirmed';
  return labelOf(LEVELS, level, level);
}

export const LANGUAGE_LEVELS = [
  { value: 'native', label: 'Native' }, { value: 'fluent', label: 'Fluent' }, { value: 'conversational', label: 'Conversational' }
];
export const WORK_PREFS = [
  { value: 'remote', label: 'Remote' }, { value: 'in_office', label: 'In-office' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'none', label: 'No preference' }
];
export const DISPLAY_OPTIONS = [
  { value: 'always', label: 'Always' }, { value: 'relevant', label: 'Only when relevant' }, { value: 'never', label: 'Never' }
];
export const SKILL_CATEGORIES = [
  { value: 'core', label: 'Core skills' }, { value: 'tool', label: 'Tool skills' }, { value: 'programming', label: 'Programming' }, { value: 'custom', label: 'Other skills' }
];
