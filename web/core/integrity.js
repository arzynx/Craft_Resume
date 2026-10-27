/**
 * Deterministic integrity checks over a ResumeModel (SPEC section 15).
 * Runs after every build or AI output. `ok` is false when any block-severity violation exists.
 */
import { VERBS, BANNED_LEVEL_WORDS } from './data.js';
import { containsTerm, hasNonDateDigits, firstWord, clean } from './text.js';
import { effectiveSkills, isPrintableSkill } from './tailor.js';

const ENTRY_SECTIONS = new Set(['experience', 'projects']);
const BULLET_LIKE_SECTIONS = new Set(['experience', 'projects', 'about']);
const RATING_GLYPHS = /[●○★☆▮▯■□]/;
const RATING_FRACTION = /(?<!\d)\d+\s*\/\s*(?:5|10)(?!\d)|\d+\s*%/;

/**
 * Build a resolver that tells whether a SourceRef points at real profile/session data.
 * @returns {(src: {type:string,id:string}) => boolean}
 */
function sourceResolver(profile, session) {
  const p = profile || {};
  const ids = (list) => new Set((list || []).map((x) => x && x.id));
  const skillIds = ids(effectiveSkills(p, session));
  const eduIds = ids(p.education);
  const langIds = ids(p.languages);
  const entryIds = ids(p.entries);
  const bulletIds = new Set((p.entries || []).flatMap((e) => (e.bullets || []).map((b) => b.id)));
  const achIds = ids(p.achievements);
  const extraIds = ids(p.extracurriculars);
  const hobbyIds = ids(p.hobbies);
  const basics = p.basics || {};
  const aboutText = clean((session && session.selection && session.selection.aboutMeText) || p.aboutMe);
  return (src) => {
    if (!src || !src.type || src.id == null) return false;
    switch (src.type) {
      case 'basics': return clean(basics[src.id === 'name' ? 'fullName' : src.id]).length > 0;
      case 'education': return eduIds.has(src.id);
      case 'skill': return skillIds.has(src.id);
      case 'language': return langIds.has(src.id);
      case 'link': return clean(p.links && p.links[src.id]).length > 0;
      case 'entry': return entryIds.has(src.id);
      case 'bullet': return bulletIds.has(src.id);
      case 'achievement': return achIds.has(src.id);
      case 'extracurricular': return extraIds.has(src.id);
      case 'hobby': return hobbyIds.has(src.id);
      case 'about': return aboutText.length > 0;
      case 'work': return !!p.work;
      case 'marks': return !!(p.marks && p.marks[src.id] && clean(p.marks[src.id].value));
      default: return false;
    }
  };
}

function entryOwningBullet(profile, bulletId) {
  return (profile.entries || []).find((e) => (e.bullets || []).some((b) => b.id === bulletId)) || null;
}

function entryForLine(profile, line) {
  if (!line.src) return null;
  if (line.src.type === 'entry') return (profile.entries || []).find((e) => e.id === line.src.id) || null;
  if (line.src.type === 'bullet') return entryOwningBullet(profile, line.src.id);
  return null;
}

function numberConfirmed(session, lineId, entryId) {
  const conf = (session && session.numberConfirmations) || {};
  return !!((conf[lineId] && conf[lineId].confirmed) || (conf[entryId] && conf[entryId].confirmed));
}

/**
 * Run every integrity rule against a built model.
 * @param {object} model ResumeModel
 * @param {object} profile
 * @param {object} session
 * @returns {{ ok: boolean, violations: {code:string, message:string, lineId:string|null, severity:'block'|'warn'}[] }}
 */
export function checkIntegrity(model, profile, session) {
  const violations = [];
  const block = (code, message, lineId) => violations.push({ code, message, lineId: lineId == null ? null : lineId, severity: 'block' });
  const warn = (code, message, lineId) => violations.push({ code, message, lineId: lineId == null ? null : lineId, severity: 'warn' });
  const p = profile || {};
  const resolves = sourceResolver(p, session);
  const skills = effectiveSkills(p, session);
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const printedSkillNames = skills.filter(isPrintableSkill).map((s) => clean(s.name)).filter(Boolean);
  const labelledNames = skills.filter((s) => s.level === 'have_ai' || s.level === 'exposure').map((s) => clean(s.name)).filter(Boolean);
  const exposureNames = skills.filter((s) => s.level === 'exposure').map((s) => clean(s.name)).filter(Boolean);
  const header = (model && model.header) || { contactLine: [], links: [] };
  const sections = (model && model.sections) || [];

  // NO_SOURCE: header items and links
  for (const c of header.contactLine || []) {
    if (!resolves(c.src)) block('NO_SOURCE', `Contact item "${c.text}" has no source in the profile.`, `header:${c.src ? c.src.id : '?'}`);
    if (RATING_GLYPHS.test(c.text || '')) block('RATING_GRAPHIC', `Contact item "${c.text}" contains a rating glyph.`, `header:${c.src ? c.src.id : '?'}`);
  }
  for (const l of header.links || []) {
    if (!resolves(l.src)) block('NO_SOURCE', `Link "${l.label}" has no source in the profile.`, `link:${l.src ? l.src.id : '?'}`);
  }

  for (const section of sections) {
    const isSkills = section.key === 'skills';
    for (const item of section.items || []) {
      if (!resolves(item.src)) block('NO_SOURCE', `"${item.heading || item.id}" in ${section.title || section.key} has no source.`, item.id);
      for (const line of item.lines || []) {
        const text = line.text || '';
        const srcs = Array.isArray(line.srcs) && line.srcs.length ? line.srcs.map((id) => ({ type: line.src ? line.src.type : '', id })) : [line.src];
        if (!line.src || srcs.some((s) => !resolves(s))) block('NO_SOURCE', `Line "${text.slice(0, 60)}" has no resolvable source.`, line.id);

        if (RATING_GLYPHS.test(text)) block('RATING_GRAPHIC', `Line contains a rating glyph: "${text.slice(0, 60)}"`, line.id);
        const mentionsSkill = printedSkillNames.some((n) => containsTerm(text, n));
        if (RATING_FRACTION.test(text) && (isSkills || mentionsSkill)) block('RATING_GRAPHIC', `Line rates a skill with a fraction or percentage: "${text.slice(0, 60)}"`, line.id);

        const banned = BANNED_LEVEL_WORDS.filter((w) => containsTerm(text, w));
        if (banned.length) {
          const nearLabelled = labelledNames.some((n) => containsTerm(text, n));
          if (isSkills) block('BANNED_WORD', `Skills line uses a banned level word (${banned.join(', ')}).`, line.id);
          else if (nearLabelled) block('BANNED_WORD', `Line uses "${banned[0]}" next to an AI-assisted or exposure skill.`, line.id);
        }

        if (isSkills) {
          for (const id of line.srcs || [line.src && line.src.id]) {
            const s = skillById.get(id);
            if (!s) continue;
            if (!['have', 'have_ai', 'exposure'].includes(s.level)) block('UNCONFIRMED_SKILL', `Skill "${s.name}" is printed without a confirmed level.`, line.id);
            else if (s.level !== 'exposure' && !clean(s.whereUsed)) block('UNCONFIRMED_SKILL', `Skill "${s.name}" is printed without a "Where I used it" note.`, line.id);
          }
        }

        if (BULLET_LIKE_SECTIONS.has(section.key)) {
          const hit = exposureNames.find((n) => containsTerm(text, n));
          if (hit) block('EXPOSURE_IN_BULLET', `"${hit}" is an exposure-level skill and may only appear in the Skills list.`, line.id);
        }

        if (ENTRY_SECTIONS.has(section.key) && hasNonDateDigits(text)) {
          const entry = entryForLine(p, line);
          const status = entry && entry.result ? entry.result.numberStatus : 'unconfirmed';
          const confirmed = status === 'evidence' || status === 'confirmed' || numberConfirmed(session, line.id, entry ? entry.id : null);
          if (!confirmed) block('UNCONFIRMED_NUMBER', `Number in "${text.slice(0, 60)}" has no evidence or confirmation.`, line.id);
        }

        if (line.src && line.src.type === 'bullet') {
          const w = firstWord(text).toLowerCase();
          if (!VERBS.set.has(w)) warn('MISSING_VERB', `Bullet does not start with an approved action verb: "${text.slice(0, 60)}"`, line.id);
        }
      }
    }
  }

  return { ok: !violations.some((v) => v.severity === 'block'), violations };
}
