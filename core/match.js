/**
 * Private match summary (never part of the resume): met / partial / not met requirements,
 * work-mode fit, what was verified, and interview-prep notes.
 */
import { SOURCES, UNVERIFIED_SOURCE_CAUTION, findCatalogSkill } from './data.js';
import { containsTerm, hasNonDateDigits, clean } from './text.js';
import { effectiveSkills, isPrintableSkill, isSparseProfile } from './tailor.js';
import { emptyExtraction } from './extract.js';

const MODE_LABEL = { remote: 'remote', in_office: 'in-office', hybrid: 'hybrid' };
const CHECK_NOTE = {
  found: 'Company found: an organization with this name appears to exist. This does not confirm the posting is genuine or current.',
  multiple: 'Multiple organizations match this name; pick the right one. The posting itself was not verified.',
  could_not_confirm: 'Could not confirm an organization with this name. Tailoring continues; verify independently.',
  not_checked: 'Company not checked (offline or rules-only mode).',
};

/**
 * Find the profile/overlay skill matching a canonical catalog name.
 */
function skillForCanonical(skills, canonical) {
  const target = clean(canonical).toLowerCase();
  if (!target) return null;
  return skills.find((s) => clean(s.name).toLowerCase() === target)
    || skills.find((s) => { const c = findCatalogSkill(s.name); return c && c.name.toLowerCase() === target; })
    || null;
}

function bulletTexts(model) {
  return ((model && model.sections) || [])
    .filter((s) => ['experience', 'projects', 'about', 'extracurriculars', 'achievements'].includes(s.key))
    .flatMap((s) => s.items.flatMap((it) => [it.heading, it.sub, ...it.lines.map((l) => l.text)]))
    .filter(Boolean);
}

function requirementStatus(req, skills, bullets) {
  const skill = req.canonicalSkill ? skillForCanonical(skills, req.canonicalSkill) : null;
  if (skill && (skill.level === 'have' || skill.level === 'have_ai') && clean(skill.whereUsed)) {
    return { status: 'met', via: skill.level === 'have_ai' ? `${clean(skill.name)} (AI-assisted)` : clean(skill.name) };
  }
  if (skill && skill.level === 'exposure') return { status: 'partial', via: `${clean(skill.name)} (exposure)` };
  const term = req.canonicalSkill || (clean(req.text).length <= 40 ? clean(req.text) : null);
  if (term && bullets.some((t) => containsTerm(t, term))) return { status: 'met', via: 'bullet' };
  return { status: 'not_met', via: null };
}

/**
 * Work-mode fit sentence comparing the posting with the student's preference.
 */
export function workModeFitText(extractionMode, preference) {
  const want = MODE_LABEL[preference];
  const posting = MODE_LABEL[extractionMode];
  if (!posting && !want) return 'The posting does not state a work mode and you have no preference set.';
  if (!posting) return `The posting does not state a work mode; your preference is ${want}.`;
  if (!want) return `The posting is ${posting}; you have no work-mode preference set.`;
  if (posting === want) return `The posting is ${posting}, which matches your preference.`;
  return `The posting is ${posting}; your preference is ${want}. Decide before applying.`;
}

function interviewPrep(skills, model) {
  const lines = [];
  const printable = skills.filter(isPrintableSkill);
  const ai = printable.filter((s) => s.level === 'have_ai').map((s) => clean(s.name));
  const exposure = printable.filter((s) => s.level === 'exposure').map((s) => clean(s.name));
  if (ai.length) lines.push(`AI-assisted skills (${ai.join(', ')}): be ready to explain what you did yourself and where AI helped.`);
  if (exposure.length) lines.push(`Exposure-level skills (${exposure.join(', ')}): expect "how much have you actually used this?"`);
  for (const section of (model && model.sections) || []) {
    if (section.key !== 'experience' && section.key !== 'projects') continue;
    for (const item of section.items) {
      for (const line of item.lines) {
        if (hasNonDateDigits(line.text)) lines.push(`Number in "${line.text.slice(0, 70)}": know exactly how you got it.`);
      }
    }
  }
  const hobbies = (model && model.sections || []).find((s) => s.key === 'hobbies');
  if (hobbies) lines.push(`Hobbies (${hobbies.items[0].lines[0].text}): expect a casual question; keep the answer honest and short.`);
  return lines;
}

/**
 * Build the private match summary for a session.
 * @param {object} profile
 * @param {object} session
 * @param {object} model ResumeModel built from the same session
 * @returns {{ requirements: object[], workModeFit: string, verification: object, interviewPrep: string[], sparse: boolean, missing: object[] }}
 */
export function buildMatchSummary(profile, session, model) {
  const s = session || {};
  const ex = s.extraction || emptyExtraction();
  const skills = effectiveSkills(profile, s);
  const bullets = bulletTexts(model);
  const requirements = (ex.requirements || []).map((req) => ({
    id: req.id,
    text: req.text,
    priority: req.priority || 'unknown',
    canonicalSkill: req.canonicalSkill || null,
    ...requirementStatus(req, skills, bullets),
  }));
  const source = SOURCES.find((x) => x.id === (s.role && s.role.source));
  const status = (s.companyCheck && s.companyCheck.status) || 'not_checked';
  const verification = {
    companyCheck: status,
    companyNote: CHECK_NOTE[status] || CHECK_NOTE.not_checked,
    sourceUnverified: !!(source && source.unverified),
    sourceLabel: source ? source.label : '',
    feeWarning: !!ex.feeWarning,
    caution: (source && source.unverified) || ex.feeWarning ? UNVERIFIED_SOURCE_CAUTION : '',
  };
  return {
    requirements,
    missing: requirements.filter((r) => r.status === 'not_met'),
    workModeFit: workModeFitText(ex.workMode, profile && profile.work && profile.work.preference),
    verification,
    interviewPrep: interviewPrep(skills, model),
    sparse: isSparseProfile(profile),
  };
}
