/**
 * Guards around optional AI output. AI may suggest; these checks decide what is allowed through.
 * Everything rejected falls back to the rules-only result or the student's original text.
 */
import { SKILL_CATALOG, FAMILIES, VERBS, BANNED_LEVEL_WORDS, findCatalogSkill } from './data.js';
import { containsTerm, firstWord, clean } from './text.js';
import { suggestFamily, emptyExtraction } from './extract.js';

const WORK_MODES = new Set(['remote', 'in_office', 'hybrid']);
const PRIORITIES = new Set(['must', 'nice', 'unknown']);
const FAMILY_IDS = new Set(FAMILIES.map((f) => f.id));
const PRONOUN = /(?<![A-Za-z])(?:I|me|my|we|our)(?![A-Za-z])/;

const arr = (v) => (Array.isArray(v) ? v : []);
const bool = (v) => v === true;
const strOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * True when at least 60% of the requirement's words (or its canonical skill) occur in the posting text.
 * @param {{text:string, canonicalSkill:string|null}} req
 * @param {string} jdLower lower-cased posting
 */
export function groundedInPosting(req, jdLower) {
  if (req.canonicalSkill && containsTerm(jdLower, req.canonicalSkill)) return true;
  const cat = req.canonicalSkill ? findCatalogSkill(req.canonicalSkill) : null;
  if (cat && [cat.name, ...cat.aliases].some((a) => containsTerm(jdLower, a))) return true;
  const words = clean(req.text).toLowerCase().match(/[a-z0-9+#.]+/g) || [];
  if (!words.length) return false;
  const hits = words.filter((w) => jdLower.includes(w)).length;
  return hits / words.length >= 0.6;
}

function coerceRequirement(r, i) {
  if (!r || typeof r !== 'object') return null;
  const text = clean(r.text);
  if (!text) return null;
  const cat = r.canonicalSkill ? findCatalogSkill(r.canonicalSkill) : null;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : `req-${i + 1}`,
    text: text.slice(0, 200),
    canonicalSkill: cat ? cat.name : null,
    priority: PRIORITIES.has(r.priority) ? r.priority : 'unknown',
  };
}

/**
 * Coerce an AI-produced extraction into the Extraction shape, dropping anything not grounded in the posting.
 * Returns null when `raw` is not an object at all.
 * @param {any} raw
 * @param {string} jdText
 * @returns {object|null} Extraction
 */
export function validateAiExtraction(raw, jdText) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const jd = String(jdText || '');
  const jdLower = jd.toLowerCase();
  const base = emptyExtraction();
  const requirements = arr(raw.requirements)
    .map(coerceRequirement)
    .filter(Boolean)
    .filter((r) => groundedInPosting(r, jdLower))
    .slice(0, 40)
    .map((r, i) => ({ ...r, id: `req-${i + 1}` }));
  const em = raw.educationMentioned && typeof raw.educationMentioned === 'object' ? raw.educationMentioned : {};
  const lr = raw.linksRequested && typeof raw.linksRequested === 'object' ? raw.linksRequested : {};
  const sf = raw.suggestedFamily && typeof raw.suggestedFamily === 'object' ? raw.suggestedFamily : {};
  const suggested = FAMILY_IDS.has(sf.primary)
    ? { primary: sf.primary, secondary: FAMILY_IDS.has(sf.secondary) && sf.secondary !== sf.primary ? sf.secondary : null, reason: clean(sf.reason) || 'Suggested by AI' }
    : suggestFamily(strOrNull(raw.title) || '', jd);
  const designMentioned = requirements.some((r) => { const c = findCatalogSkill(r.canonicalSkill); return c && c.designTool; });
  return {
    ...base,
    requirements,
    workMode: WORK_MODES.has(raw.workMode) ? raw.workMode : null,
    location: strOrNull(raw.location),
    duration: strOrNull(raw.duration),
    stipend: strOrNull(raw.stipend),
    educationMentioned: { degree: bool(em.degree), year: bool(em.year), cgpa: bool(em.cgpa), coursework: bool(em.coursework) },
    linksRequested: { github: bool(lr.github), portfolio: bool(lr.portfolio), linkedin: bool(lr.linkedin) },
    designToolsMentioned: bool(raw.designToolsMentioned) || designMentioned,
    availabilityAsked: bool(raw.availabilityAsked),
    feeWarning: bool(raw.feeWarning),
    unreadable: arr(raw.unreadable).filter((x) => typeof x === 'string').map(clean).filter(Boolean).slice(0, 10),
    suggestedFamily: suggested,
  };
}

/**
 * Tool and programming skills (name + aliases) whose mention in a rewrite counts as a new tool claim.
 */
const TOOL_TERMS = SKILL_CATALOG
  .filter((s) => s.category !== 'core')
  .map((s) => ({ skill: s, terms: [s.name, ...s.aliases] }));

function isConfirmed(skill, confirmedSkills) {
  return confirmedSkills.some((name) => {
    const n = clean(name).toLowerCase();
    if (!n) return false;
    if (n === skill.name.toLowerCase()) return true;
    const cat = findCatalogSkill(n);
    return !!(cat && cat.name === skill.name);
  });
}

/**
 * Validate an AI rewording of one bullet. The original is returned when any rule fails.
 * @param {string} original student's own text
 * @param {string} reworded AI suggestion
 * @param {{confirmedSkills?: string[]}} [ctx]
 * @returns {{ ok: boolean, text: string, reasons: string[] }}
 */
export function validateReword(original, reworded, ctx = {}) {
  const confirmedSkills = arr(ctx && ctx.confirmedSkills);
  const o = String(original == null ? '' : original);
  const r = String(reworded == null ? '' : reworded);
  const rc = clean(r);
  const reasons = [];

  if (!rc) reasons.push('Rewrite is empty');

  const originalNumbers = new Set(o.match(/\d+/g) || []);
  for (const n of new Set(rc.match(/\d+/g) || [])) {
    if (!originalNumbers.has(n)) reasons.push(`Introduces a number not in the original: ${n}`);
  }

  const banned = BANNED_LEVEL_WORDS.filter((w) => containsTerm(rc, w));
  if (banned.length) reasons.push(`Contains banned level word: ${banned.join(', ')}`);

  for (const { skill, terms } of TOOL_TERMS) {
    const inRewrite = terms.some((t) => containsTerm(rc, t));
    if (!inRewrite) continue;
    const inOriginal = terms.some((t) => containsTerm(o, t));
    if (!inOriginal && !isConfirmed(skill, confirmedSkills)) reasons.push(`Mentions "${skill.name}" which is neither in the original nor a confirmed skill`);
  }

  if (rc && !VERBS.set.has(firstWord(rc).toLowerCase())) reasons.push('Does not start with an approved action verb');
  if (rc.length > 110) reasons.push(`Longer than 110 characters (${rc.length})`);
  if (PRONOUN.test(rc)) reasons.push('Contains a personal pronoun (I, me, my, we, our)');

  const ok = reasons.length === 0;
  return { ok, text: ok ? rc : o, reasons };
}
