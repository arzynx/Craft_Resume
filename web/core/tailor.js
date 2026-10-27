/**
 * Deterministic resume builder: profile + session -> ResumeModel.
 * Every printed line carries a SourceRef back to the profile or session.
 */
import { SECTION_TITLES, STANDARD_SECTION_ORDER, findCatalogSkill, familyById } from './data.js';
import { formatRange, formatMonth, clean, hasNonDateDigits } from './text.js';
import { emptyExtraction } from './extract.js';

const PRINTABLE_LEVELS = new Set(['have', 'have_ai', 'exposure']);
const LINK_LABELS = { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio' };
const LINK_ORDER = ['linkedin', 'github', 'portfolio'];

/**
 * Profile skills + session overlay skills, with session confirmations applied (level / whereUsed changes
 * that are "only for this resume" or not yet saved). Returns copies; never mutates inputs.
 * @param {object} profile
 * @param {object} session
 * @returns {object[]} skills
 */
export function effectiveSkills(profile, session) {
  const base = [...(profile?.skills || []), ...(session?.overlay?.skills || [])].map((s) => ({ ...s }));
  const byId = new Map(base.map((s) => [s.id, s]));
  for (const c of session?.confirmations || []) {
    const s = byId.get(c?.skillId);
    if (!s) continue;
    if (c.level) s.level = c.aiAssisted && c.level === 'have' ? 'have_ai' : c.level;
    if (c.whereUsed) s.whereUsed = c.whereUsed;
    if (c.exposureNote) s.exposureNote = c.exposureNote;
  }
  return base;
}

/**
 * True when a skill may be printed: level have/have_ai (with a whereUsed note) or exposure.
 * @param {object} s skill
 */
export function isPrintableSkill(s) {
  if (!s || !PRINTABLE_LEVELS.has(s.level)) return false;
  if (s.level === 'exposure') return true;
  return clean(s.whereUsed).length > 0;
}

/**
 * Skills that pass the printing rule.
 * @param {object} profile
 * @param {object} session
 */
export function printableSkills(profile, session) {
  return effectiveSkills(profile, session).filter(isPrintableSkill);
}

/**
 * Whether a skill is a design tool (own flag or catalog flag).
 * @param {object} s
 */
export function isDesignTool(s) {
  if (s?.designTool === true) return true;
  const cat = findCatalogSkill(s?.name);
  return !!(cat && cat.designTool);
}

/**
 * Decide whether a header link prints.
 * @param {string} key linkedin|github|portfolio
 */
function linkShown(key, family, secondary, extraction, overrides) {
  const o = overrides ? overrides[key] : null;
  if (o === true) return true;
  if (o === false) return false;
  if (key === 'linkedin') return true;
  if (family.links.includes(key)) return true;
  if (secondary && secondary.links.includes(key)) return true;
  return !!(extraction.linksRequested && extraction.linksRequested[key]);
}

/**
 * "Available 15 hrs/week from Jun 2026, remote" or '' when nothing is filled in.
 * @param {object} work
 */
export function availabilityText(work) {
  if (!work) return '';
  const parts = [];
  if (clean(work.hoursPerWeek)) parts.push(`${clean(work.hoursPerWeek)} hrs/week`);
  if (clean(work.startDate)) parts.push(`from ${formatMonth(work.startDate)}`);
  const pref = { remote: 'remote', in_office: 'in-office', hybrid: 'hybrid' }[work.preference];
  if (!parts.length && !pref) return '';
  let text = parts.length ? `Available ${parts.join(' ')}` : 'Available';
  if (pref) text += `, ${pref}`;
  return text;
}

function buildHeader(profile, session, family, secondary, extraction) {
  const b = profile.basics || {};
  const contactLine = [];
  if (clean(b.email)) contactLine.push({ text: clean(b.email), src: { type: 'basics', id: 'email' } });
  if (clean(b.phone)) contactLine.push({ text: clean(b.phone), src: { type: 'basics', id: 'phone' } });
  if (clean(b.city)) {
    const text = clean(b.country) ? `${clean(b.city)}, ${clean(b.country)}` : clean(b.city);
    contactLine.push({ text, src: { type: 'basics', id: 'city' } });
  }
  if (extraction.availabilityAsked) {
    const text = availabilityText(profile.work);
    if (text) contactLine.push({ text, src: { type: 'work', id: 'work' } });
  }
  const links = [];
  for (const key of LINK_ORDER) {
    const url = clean(profile.links && profile.links[key]);
    if (!url) continue;
    if (!linkShown(key, family, secondary, extraction, session.linkOverrides)) continue;
    links.push({ label: LINK_LABELS[key], url, src: { type: 'link', id: key } });
  }
  const wantsPhoto = session.template && session.template.graphics === 'photo';
  return {
    name: clean(b.fullName),
    headline: clean(b.headline),
    contactLine,
    links,
    photoDataUrl: wantsPhoto && b.photoDataUrl ? b.photoDataUrl : null,
  };
}

function skillLine(id, text, skills) {
  return { id, text, src: { type: 'skill', id: skills[0].id }, srcs: skills.map((s) => s.id) };
}

function buildSkillsItems(profile, session, family, extraction) {
  let skills = printableSkills(profile, session);
  const software = family.id === 'software_web';
  if (software && !extraction.designToolsMentioned) skills = skills.filter((s) => !isDesignTool(s));
  if (software) {
    const prog = skills.filter((s) => s.category === 'programming');
    const rest = skills.filter((s) => s.category !== 'programming');
    skills = [...prog, ...rest];
  }
  const have = skills.filter((s) => s.level === 'have');
  const ai = skills.filter((s) => s.level === 'have_ai');
  const exposure = skills.filter((s) => s.level === 'exposure');
  const lines = [];
  if (have.length) lines.push(skillLine('skills-have', have.map((s) => clean(s.name)).join(', '), have));
  if (ai.length) lines.push(skillLine('skills-ai', `AI-assisted: ${ai.map((s) => clean(s.name)).join(', ')}`, ai));
  if (exposure.length) {
    const text = exposure.map((s) => (clean(s.exposureNote) ? `${clean(s.name)} (${clean(s.exposureNote)})` : clean(s.name))).join(', ');
    lines.push(skillLine('skills-exposure', `Exposure: ${text}`, exposure));
  }
  if (!lines.length) return [];
  return [{ id: 'skills', src: lines[0].src, heading: '', sub: '', dateRange: '', lines }];
}

/**
 * Result line prints only with evidence, confirmation, or when it has no number at all.
 */
function resultPrintable(entry, session) {
  const r = entry.result;
  if (!r || !clean(r.text)) return false;
  if (!hasNonDateDigits(r.text)) return true;
  if (r.numberStatus === 'evidence' || r.numberStatus === 'confirmed') return true;
  const conf = session.numberConfirmations || {};
  return !!((conf[entry.id] && conf[entry.id].confirmed) || (conf[`${entry.id}-result`] && conf[`${entry.id}-result`].confirmed));
}

function entryItem(entry, session) {
  const edits = session.bulletEdits || {};
  const lines = (entry.bullets || [])
    .map((b) => ({ id: b.id, text: clean(Object.prototype.hasOwnProperty.call(edits, b.id) ? edits[b.id] : b.text), src: { type: 'bullet', id: b.id } }))
    .filter((l) => l.text);
  if (resultPrintable(entry, session)) {
    lines.push({ id: `${entry.id}-result`, text: clean(entry.result.text), src: { type: 'entry', id: entry.id }, kind: 'result' });
  }
  return {
    id: entry.id,
    src: { type: 'entry', id: entry.id },
    heading: clean(entry.title),
    sub: [clean(entry.organization), clean(entry.role)].filter(Boolean).join(', '),
    dateRange: formatRange(entry.start, entry.end),
    lines,
  };
}

function markShown(mark, extraction, family) {
  if (!mark || mark.value == null || clean(mark.value) === '') return false;
  if (mark.display === 'always') return true;
  if (mark.display === 'never') return false;
  return !!(extraction.educationMentioned && extraction.educationMentioned.cgpa) || family.id === 'general';
}

function marksLines(profile, extraction, family) {
  const m = profile.marks || {};
  const lines = [];
  if (markShown(m.cgpa, extraction, family)) lines.push({ id: 'marks-cgpa', text: `CGPA: ${clean(m.cgpa.value)}`, src: { type: 'marks', id: 'cgpa' } });
  if (markShown(m.twelfth, extraction, family)) lines.push({ id: 'marks-twelfth', text: `Class XII: ${clean(m.twelfth.value)}`, src: { type: 'marks', id: 'twelfth' } });
  return lines;
}

/**
 * Education display mode: the posting's education mentions upgrade any family to 'prominent'.
 */
export function educationMode(family, extraction) {
  const em = extraction.educationMentioned || {};
  if (em.degree || em.year || em.cgpa || em.coursework) return 'prominent';
  return family.education;
}

function educationItems(profile, mode, extraction, family) {
  const items = (profile.education || []).map((ed) => {
    const degree = [clean(ed.degree), clean(ed.branch)].filter(Boolean).join(' ');
    const expected = clean(ed.expectedGradYear) ? `expected ${clean(ed.expectedGradYear)}` : '';
    const src = { type: 'education', id: ed.id };
    if (mode === 'compact') {
      return { id: ed.id, src, heading: [degree, clean(ed.institution), expected].filter(Boolean).join(', '), sub: '', dateRange: '', lines: [] };
    }
    const lines = [];
    const courses = (ed.coursework || []).map(clean).filter(Boolean).slice(0, 4);
    if (courses.length) lines.push({ id: `${ed.id}-coursework`, text: `Relevant coursework: ${courses.join(', ')}`, src });
    const year = clean(ed.yearOfStudy) ? `Year ${clean(ed.yearOfStudy)}` : '';
    return {
      id: ed.id,
      src,
      heading: degree,
      sub: [clean(ed.institution), year].filter(Boolean).join(', '),
      dateRange: expected ? `Expected ${clean(ed.expectedGradYear)}` : '',
      lines,
    };
  });
  const marks = marksLines(profile, extraction, family);
  if (marks.length) {
    if (items.length) items[0].lines.push(...marks);
    else items.push({ id: 'marks', src: marks[0].src, heading: '', sub: '', dateRange: '', lines: marks });
  }
  return items;
}

function detailItems(list, ids, type) {
  const byId = new Map((list || []).map((x) => [x.id, x]));
  return (ids || []).map((id) => byId.get(id)).filter(Boolean).map((x) => ({
    id: x.id,
    src: { type, id: x.id },
    heading: clean(x.name),
    sub: '',
    dateRange: clean(x.date),
    lines: clean(x.detail) ? [{ id: `${x.id}-detail`, text: clean(x.detail), src: { type, id: x.id } }] : [],
  }));
}

function hobbiesItems(profile, selection) {
  const byId = new Map((profile.hobbies || []).map((h) => [h.id, h]));
  const picked = (selection.hobbyIds || []).map((id) => byId.get(id)).filter(Boolean).slice(0, 4);
  if (!picked.length) return [];
  const text = picked.map((h) => (clean(h.detail) ? `${clean(h.name)} (${clean(h.detail)})` : clean(h.name))).join(', ');
  const src = { type: 'hobby', id: picked[0].id };
  return [{ id: 'hobbies', src, heading: '', sub: '', dateRange: '', lines: [{ id: 'hobbies-line', text, src, srcs: picked.map((h) => h.id) }] }];
}

function languagesItems(profile) {
  const langs = (profile.languages || []).filter((l) => l.level && clean(l.name));
  if (!langs.length) return [];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const text = langs.map((l) => `${clean(l.name)} (${cap(l.level)})`).join(', ');
  const src = { type: 'language', id: langs[0].id };
  return [{ id: 'languages', src, heading: '', sub: '', dateRange: '', lines: [{ id: 'languages-line', text, src, srcs: langs.map((l) => l.id) }] }];
}

function aboutItems(profile, selection) {
  if (!selection.includeAboutMe) return [];
  const text = clean(selection.aboutMeText || profile.aboutMe);
  if (!text) return [];
  const src = { type: 'about', id: 'about' };
  return [{ id: 'about', src, heading: '', sub: '', dateRange: '', lines: [{ id: 'about-text', text, src }] }];
}

/**
 * Section order for this resume: the family order, with education pulled forward when prominent.
 */
export function sectionOrder(family, mode) {
  const order = [...family.order];
  for (const key of STANDARD_SECTION_ORDER) if (!order.includes(key)) order.push(key);
  if (mode !== 'prominent' || family.id === 'general') return order;
  const without = order.filter((k) => k !== 'education');
  const skillsIdx = without.indexOf('skills');
  without.splice(skillsIdx < 0 ? 0 : skillsIdx + 1, 0, 'education');
  return without;
}

/**
 * Fewer than 2 entries across experience, projects, extracurriculars and achievements.
 * @param {object} profile
 */
export function isSparseProfile(profile) {
  const n = (profile?.entries || []).length + (profile?.extracurriculars || []).length + (profile?.achievements || []).length;
  return n < 2;
}

/**
 * Build the resume model for one tailoring session. Deterministic: same inputs, same output.
 * @param {object} profile master profile
 * @param {object} session tailoring session
 * @returns {object} ResumeModel
 */
export function buildResume(profile, session) {
  const p = profile || {};
  const s = session || {};
  const extraction = s.extraction || emptyExtraction();
  const family = familyById(s.family && s.family.primary);
  const secondary = s.family && s.family.secondary && s.family.secondary !== family.id ? familyById(s.family.secondary) : null;
  const selection = s.selection || {};
  const mode = educationMode(family, extraction);

  const entriesById = new Map((p.entries || []).map((e) => [e.id, e]));
  const selectedEntries = (selection.entryIds || []).map((id) => entriesById.get(id)).filter(Boolean);
  const experience = selectedEntries.filter((e) => e.kind === 'experience').map((e) => entryItem(e, s));
  const projects = selectedEntries.filter((e) => e.kind !== 'experience').map((e) => entryItem(e, s));

  const byKey = {
    about: aboutItems(p, selection),
    skills: buildSkillsItems(p, s, family, extraction),
    experience,
    projects,
    education: educationItems(p, mode, extraction, family),
    achievements: detailItems(p.achievements, selection.achievementIds, 'achievement'),
    extracurriculars: detailItems(p.extracurriculars, selection.extracurricularIds, 'extracurricular'),
    hobbies: hobbiesItems(p, selection),
    languages: languagesItems(p),
  };

  const sections = sectionOrder(family, mode)
    .filter((key) => byKey[key] && byKey[key].length)
    .map((key) => ({ key, title: SECTION_TITLES[key], items: byKey[key] }));

  const warnings = [];
  if (!experience.length && !projects.length) warnings.push('No experience or projects selected. A genuine course project or extracurricular can be included instead.');
  if (isSparseProfile(p)) warnings.push('Sparse profile: a half-page resume is fine. Projects, extracurriculars or achievements could genuinely add detail if you have them.');
  if (!byKey.skills.length) warnings.push('No confirmed skills to print. Confirm a level and add "Where I used it" for the skills you have.');
  if (/drive\.google\.com/i.test(clean(p.links && p.links.portfolio))) warnings.push('Portfolio is a Drive link: set sharing to "Anyone with the link can view".');

  return {
    pageSize: (p.settings && p.settings.pageSize) || 'A4',
    template: (s.template && s.template.id) || 'text_first',
    family: family.id,
    secondaryFamily: secondary ? secondary.id : null,
    header: buildHeader(p, s, family, secondary, extraction),
    sections,
    trims: [],
    warnings,
  };
}
