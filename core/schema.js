/**
 * Profile schema: fresh profiles, ids, migration and validation.
 */
import { SKILL_CATALOG } from './data.js';

export const PROFILE_VERSION = 1;

const SKILL_LEVELS = new Set(['have', 'have_ai', 'exposure', 'none']);
const LANGUAGE_LEVELS = new Set(['native', 'fluent', 'conversational']);
const DISPLAY_MODES = new Set(['always', 'relevant', 'never']);
const NUMBER_STATUSES = new Set(['evidence', 'confirmed', 'unconfirmed']);
const WORK_PREFS = new Set(['remote', 'in_office', 'hybrid', 'none']);

/**
 * Generate an id. Uses crypto.randomUUID when available, otherwise a time + random fallback.
 * @returns {string}
 */
export function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

/**
 * A new skill row with level null (never printed until confirmed).
 * @param {string} name
 * @param {'core'|'tool'|'programming'|'custom'} category
 * @returns {import('./data.js').CatalogSkill & {id:string, level:null, whereUsed:string, exposureNote:string}}
 */
export function newSkill(name, category = 'custom') {
  return { id: newId(), name, category, level: null, whereUsed: '', exposureNote: '' };
}

/**
 * A new empty experience/project entry.
 * @param {'experience'|'project'} kind
 */
export function newEntry(kind = 'project') {
  return {
    id: newId(),
    kind,
    title: '',
    organization: kind === 'project' ? 'Personal project' : '',
    role: '',
    start: '',
    end: '',
    bullets: [],
    result: { text: '', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' },
  };
}

/**
 * Build a fresh master profile with the spec's prefilled skills and languages (all unconfirmed).
 * @returns {object} Profile
 */
export function newProfile() {
  return {
    version: PROFILE_VERSION,
    basics: { fullName: '', email: '', phone: '', city: '', country: '', headline: '', photoDataUrl: '' },
    education: [],
    marks: {
      cgpa: { value: null, display: 'relevant' },
      twelfth: { value: null, display: 'relevant' },
    },
    skills: SKILL_CATALOG.filter((s) => s.prefill).map((s) => newSkill(s.name, s.category)),
    languages: [
      { id: newId(), name: 'English', level: null },
      { id: newId(), name: 'Hindi', level: null },
    ],
    links: { linkedin: '', github: '', portfolio: '' },
    entries: [],
    achievements: [],
    extracurriculars: [],
    hobbies: [],
    work: { preference: 'none', hoursPerWeek: '', startDate: '' },
    aboutMe: '',
    settings: { pageSize: 'A4', aiEnabled: false, syncEnabled: false },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? '' : String(v));

function withId(item) {
  return isObj(item) && item.id ? item : { ...(isObj(item) ? item : {}), id: newId() };
}

/**
 * Bring any older / partial profile object up to the current shape without losing data.
 * Unknown keys are preserved; missing keys are filled from newProfile().
 * @param {object} obj
 * @returns {object} Profile
 */
export function migrateProfile(obj) {
  const base = newProfile();
  const p = isObj(obj) ? obj : {};
  const out = {
    ...base,
    ...p,
    version: PROFILE_VERSION,
    basics: { ...base.basics, ...(isObj(p.basics) ? p.basics : {}) },
    marks: {
      cgpa: { ...base.marks.cgpa, ...(isObj(p.marks?.cgpa) ? p.marks.cgpa : {}) },
      twelfth: { ...base.marks.twelfth, ...(isObj(p.marks?.twelfth) ? p.marks.twelfth : {}) },
    },
    links: { ...base.links, ...(isObj(p.links) ? p.links : {}) },
    work: { ...base.work, ...(isObj(p.work) ? p.work : {}) },
    settings: { ...base.settings, ...(isObj(p.settings) ? p.settings : {}) },
    aboutMe: str(p.aboutMe),
  };
  out.education = arr(p.education).map((e) => ({ coursework: [], ...withId(e), coursework: arr(e?.coursework) }));
  out.skills = (Array.isArray(p.skills) ? p.skills : base.skills).map((s) => ({
    ...withId(s),
    name: str(s?.name),
    category: s?.category || 'custom',
    level: SKILL_LEVELS.has(s?.level) ? s.level : null,
    whereUsed: str(s?.whereUsed),
    exposureNote: str(s?.exposureNote),
  }));
  out.languages = (Array.isArray(p.languages) ? p.languages : base.languages).map((l) => ({
    ...withId(l),
    name: str(l?.name),
    level: LANGUAGE_LEVELS.has(l?.level) ? l.level : null,
  }));
  out.entries = arr(p.entries).map((e) => {
    const entry = withId(e);
    const result = isObj(entry.result) ? entry.result : {};
    return {
      ...entry,
      kind: entry.kind === 'experience' ? 'experience' : 'project',
      bullets: arr(entry.bullets).map((b) => (typeof b === 'string' ? { id: newId(), text: b } : { ...withId(b), text: str(b?.text) })),
      result: {
        text: str(result.text),
        evidence: { kind: result.evidence?.kind || 'none', value: str(result.evidence?.value) },
        numberStatus: NUMBER_STATUSES.has(result.numberStatus) ? result.numberStatus : 'unconfirmed',
        sourceNote: str(result.sourceNote),
      },
    };
  });
  out.achievements = arr(p.achievements).map(withId);
  out.extracurriculars = arr(p.extracurriculars).map(withId);
  out.hobbies = arr(p.hobbies).map(withId);
  if (!DISPLAY_MODES.has(out.marks.cgpa.display)) out.marks.cgpa.display = 'relevant';
  if (!DISPLAY_MODES.has(out.marks.twelfth.display)) out.marks.twelfth.display = 'relevant';
  if (!WORK_PREFS.has(out.work.preference)) out.work.preference = 'none';
  if (out.settings.pageSize !== 'Letter') out.settings.pageSize = 'A4';
  return out;
}

/**
 * Validate a profile. Returns every problem found; `ok` is true when there are none.
 * @param {object} p
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProfile(p) {
  const errors = [];
  if (!isObj(p)) return { ok: false, errors: ['Profile must be an object'] };
  if (!isObj(p.basics)) errors.push('basics missing');
  else {
    if (!str(p.basics.fullName).trim()) errors.push('basics.fullName is required');
    const email = str(p.basics.email).trim();
    if (!email) errors.push('basics.email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('basics.email is not a valid email');
  }
  if (!Array.isArray(p.skills)) errors.push('skills must be an array');
  else {
    p.skills.forEach((s, i) => {
      if (!s || !s.id) errors.push(`skills[${i}] missing id`);
      if (!str(s?.name).trim()) errors.push(`skills[${i}] missing name`);
      if (s?.level != null && !SKILL_LEVELS.has(s.level)) errors.push(`skills[${i}] has invalid level '${s.level}'`);
      if ((s?.level === 'have' || s?.level === 'have_ai') && !str(s.whereUsed).trim()) {
        errors.push(`skills[${i}] '${s.name}': "Where I used it" is required for level ${s.level}`);
      }
    });
  }
  if (!Array.isArray(p.languages)) errors.push('languages must be an array');
  else {
    p.languages.forEach((l, i) => {
      if (l?.level != null && !LANGUAGE_LEVELS.has(l.level)) errors.push(`languages[${i}] has invalid level '${l.level}'`);
    });
  }
  if (!Array.isArray(p.entries)) errors.push('entries must be an array');
  else {
    p.entries.forEach((e, i) => {
      if (!e || !e.id) errors.push(`entries[${i}] missing id`);
      if (!str(e?.title).trim()) errors.push(`entries[${i}] missing title`);
      if (e?.kind !== 'experience' && e?.kind !== 'project') errors.push(`entries[${i}] kind must be experience or project`);
      const bullets = arr(e?.bullets);
      if (bullets.length < 2 || bullets.length > 4) errors.push(`entries[${i}] '${str(e?.title)}' needs 2-4 bullets (has ${bullets.length})`);
      bullets.forEach((b, j) => {
        if (!b || !b.id) errors.push(`entries[${i}].bullets[${j}] missing id`);
        if (!str(b?.text).trim()) errors.push(`entries[${i}].bullets[${j}] is empty`);
      });
      if (e?.start && !/^\d{4}-\d{2}$/.test(e.start)) errors.push(`entries[${i}] start must be YYYY-MM`);
      if (e?.end && !/^(\d{4}-\d{2}|present)$/i.test(e.end)) errors.push(`entries[${i}] end must be YYYY-MM or present`);
      if (e?.result && e.result.numberStatus && !NUMBER_STATUSES.has(e.result.numberStatus)) errors.push(`entries[${i}] result.numberStatus is invalid`);
    });
  }
  if (!isObj(p.marks)) errors.push('marks missing');
  else {
    for (const k of ['cgpa', 'twelfth']) {
      if (p.marks[k] && !DISPLAY_MODES.has(p.marks[k].display)) errors.push(`marks.${k}.display is invalid`);
    }
  }
  if (Array.isArray(p.hobbies) && p.hobbies.length > 4) {
    // Allowed in the profile; the resume picks up to 4. Informational only, not an error.
  }
  if (p.work && !WORK_PREFS.has(p.work.preference)) errors.push('work.preference is invalid');
  if (p.settings && p.settings.pageSize && !['A4', 'Letter'].includes(p.settings.pageSize)) errors.push('settings.pageSize must be A4 or Letter');
  return { ok: errors.length === 0, errors };
}

/**
 * A new tailoring session skeleton (useful for tests and the frontend).
 * @param {Partial<{company:string,title:string,jdText:string}>} role
 */
export function newSession(role = {}) {
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    role: { company: '', title: '', jdText: '', jdUrl: '', source: 'other', orgType: '', industry: '', note: '', ...role },
    companyCheck: { status: 'not_checked', matches: [], chosen: null, note: '' },
    extraction: null,
    family: { primary: 'general', secondary: null },
    confirmations: [],
    overlay: { skills: [] },
    selection: { entryIds: [], achievementIds: [], extracurricularIds: [], hobbyIds: [], includeAboutMe: false, aboutMeText: '' },
    linkOverrides: { linkedin: null, github: null, portfolio: null },
    bulletEdits: {},
    numberConfirmations: {},
    template: { id: 'text_first', columns: 1, graphics: 'none', colour: 'neutral' },
    approval: { approved: false, snapshotHash: null, approvedAt: null },
  };
}
