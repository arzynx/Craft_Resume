/**
 * Rules-only extraction of requirements and role facts from a job description.
 * No AI, no network: keyword and pattern matching only.
 */
import { SKILL_CATALOG, FAMILIES, INDIAN_CITIES } from './data.js';
import { termRegex, containsTerm, clean, toLines } from './text.js';

const MUST_HEADING = /^(?:(?:key |core |minimum |basic |technical )?(?:requirements?|qualifications?|skills?(?: required| needed)?|required skills?|must[- ]haves?|what (?:we(?:'re| are) looking for|you(?:'ll| will)? need|you bring)|who (?:you are|we(?:'re| are) looking for)|eligibility|responsibilities|what you(?:'ll| will)? do|your role|role requirements?|you should have|mandatory))\s*[:\-–]?\s*$/i;
const NICE_HEADING = /^(?:(?:preferred|desired|optional|bonus|nice[- ]to[- ]have|good[- ]to[- ]have|plus(?:es)?|added advantage|brownie points)(?: skills?| qualifications?)?)\s*[:\-–]?\s*$/i;
const OTHER_HEADING = /^(?:about (?:us|the (?:role|company|team))|benefits|perks|what you(?:'ll| will)? get|how to apply|compensation|stipend|location|duration|timings?|working hours|note)\s*[:\-–]?\s*$/i;

const MUST_PHRASE = /\b(?:must[- ]have|required|mandatory|essential|should have|need to have|non[- ]negotiable)\b/i;
const NICE_PHRASE = /\b(?:nice[- ]to[- ]have|good[- ]to[- ]have|preferred|preferably|bonus|a plus|is a plus|plus point|added advantage|optional|desirable)\b/i;

const WORD_NUMBERS = 'one|two|three|four|five|six|eight|nine|ten|twelve';

/** Lines that describe logistics or how to apply, not a requirement. */
const NOT_A_REQUIREMENT = /^(?:apply|send|email|share|submit|location|duration|stipend|salary|availability|timings?|working hours|start date|note|about us|we are|we're|perks?|benefits?)\b/i;

/**
 * Compile per-skill matchers once.
 * @returns {{skill: import('./data.js').CatalogSkill, regexes: RegExp[]}[]}
 */
function skillMatchers() {
  return SKILL_CATALOG.map((skill) => ({
    skill,
    regexes: [skill.name, ...skill.aliases].map(termRegex),
  }));
}

const MATCHERS = skillMatchers();

/**
 * Which section a heading opens: 'must', 'nice', 'other' or null when the line is not a heading.
 * @param {string} line
 */
function headingKind(line) {
  if (line.length > 60) return null;
  if (NICE_HEADING.test(line)) return 'nice';
  if (MUST_HEADING.test(line)) return 'must';
  if (OTHER_HEADING.test(line)) return 'other';
  return null;
}

/**
 * Priority of a single requirement line, given the section it sits in.
 * @param {string} line
 * @param {'must'|'nice'|'other'|null} section
 * @returns {'must'|'nice'|'unknown'}
 */
function linePriority(line, section) {
  if (NICE_PHRASE.test(line)) return 'nice';
  if (MUST_PHRASE.test(line)) return 'must';
  if (section === 'must') return 'must';
  if (section === 'nice') return 'nice';
  return 'unknown';
}

const RANK = { must: 3, nice: 2, unknown: 1 };

/**
 * Walk the lines, tagging each with its section and priority.
 * @param {string[]} lines
 */
function tagLines(lines) {
  let section = null;
  return lines.map((line) => {
    const kind = headingKind(line);
    if (kind) {
      section = kind;
      return { line, heading: true, section, priority: 'unknown' };
    }
    return { line, heading: false, section, priority: linePriority(line, section) };
  });
}

/**
 * Match catalog skills against tagged lines. One requirement per matched skill.
 */
function matchSkills(tagged) {
  /** @type {Map<string, {text:string, canonicalSkill:string, priority:string, designTool:boolean}>} */
  const found = new Map();
  const matchedLineIdx = new Set();
  tagged.forEach((t, idx) => {
    if (t.heading) return;
    for (const { skill, regexes } of MATCHERS) {
      if (!regexes.some((r) => r.test(t.line))) continue;
      matchedLineIdx.add(idx);
      const prev = found.get(skill.name);
      if (!prev) {
        found.set(skill.name, { text: clean(t.line).slice(0, 200), canonicalSkill: skill.name, priority: t.priority, designTool: !!skill.designTool });
      } else if (RANK[t.priority] > RANK[prev.priority]) {
        prev.priority = t.priority;
        prev.text = clean(t.line).slice(0, 200);
      }
    }
  });
  return { found: [...found.values()], matchedLineIdx };
}

/**
 * Short requirement bullets under a requirements heading that matched no catalog skill.
 */
function unmatchedBullets(tagged, matchedLineIdx, limit = 10) {
  const out = [];
  tagged.forEach((t, idx) => {
    if (out.length >= limit || t.heading || matchedLineIdx.has(idx)) return;
    if (t.section !== 'must' && t.section !== 'nice') return;
    const text = clean(t.line);
    if (text.length < 8 || text.length > 140) return;
    if (/^(?:and|or|the|a|an)\b/i.test(text) && text.length < 15) return;
    if (NOT_A_REQUIREMENT.test(text)) return;
    out.push({ text, canonicalSkill: null, priority: t.priority });
  });
  return out;
}

/**
 * Work mode from keywords. Hybrid wins when mentioned; else remote vs in-office by first mention.
 * @param {string} text
 * @returns {'remote'|'in_office'|'hybrid'|null}
 */
export function detectWorkMode(text) {
  const t = String(text || '');
  if (/\bhybrid\b/i.test(t)) return 'hybrid';
  const remote = t.search(/\b(?:remote|work[- ]from[- ]home|wfh)\b/i);
  const office = t.search(/\b(?:in[- ]office|on[- ]site|onsite|office[- ]based|work from (?:our )?office|in[- ]person)\b/i);
  if (remote < 0 && office < 0) return null;
  if (remote < 0) return 'in_office';
  if (office < 0) return 'remote';
  return remote <= office ? 'remote' : 'in_office';
}

/**
 * Location: explicit "Location: X" line, else the first Indian city mentioned.
 * @param {string} text
 * @returns {string|null}
 */
export function detectLocation(text) {
  const t = String(text || '');
  const m = t.match(/\blocation\s*[:\-–]\s*([^\n.;|]{2,60})/i);
  if (m) return clean(m[1]);
  for (const city of INDIAN_CITIES) if (containsTerm(t, city)) return city;
  return null;
}

/**
 * Duration like "3 months", "6-month", "two months".
 * @param {string} text
 * @returns {string|null}
 */
export function detectDuration(text) {
  const m = String(text || '').match(new RegExp(`\\b(\\d{1,2}|${WORD_NUMBERS})\\s*(?:-|to|–)?\\s*(\\d{1,2})?[\\s-]*(months?|weeks?)\\b`, 'i'));
  return m ? clean(m[0]) : null;
}

/**
 * Stipend snippet: currency amount or the sentence fragment around "stipend".
 * @param {string} text
 * @returns {string|null}
 */
export function detectStipend(text) {
  const t = String(text || '');
  const amount = t.match(/(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d+)?\s*(?:k|K|lakh|LPA|lpa)?(?:\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|K)?)?(?:\s*(?:per|\/|a)\s*(?:month|mo|week|hour|hr))?/i);
  if (amount) return clean(amount[0]);
  const word = t.match(/\bstipend\b[^.\n]{0,60}/i);
  if (word) return clean(word[0]);
  if (/\b(?:unpaid|no stipend)\b/i.test(t)) return 'Unpaid';
  return null;
}

/**
 * Education mentions as booleans.
 * @param {string} text
 */
export function detectEducation(text) {
  const t = String(text || '');
  return {
    degree: /\b(?:b\.?tech|b\.?e\.?|bachelor'?s?|bca|b\.?sc|bba|b\.?com|m\.?tech|mca|degree|undergraduate|graduate|pursuing|engineering student)\b/i.test(t),
    year: /\b(?:(?:1st|2nd|3rd|4th|first|second|third|final|pre-final)[- ]year|year of study|semester)\b/i.test(t),
    cgpa: /\b(?:cgpa|gpa|percentage|marks|aggregate|academic record)\b/i.test(t),
    coursework: /\b(?:coursework|relevant courses?|subjects?)\b/i.test(t),
  };
}

/**
 * Which links the posting asks for.
 * @param {string} text
 */
export function detectLinks(text) {
  const t = String(text || '');
  return {
    github: /\bgithub\b/i.test(t),
    portfolio: /\b(?:portfolio|showreel|show reel|behance|dribbble|work samples|sample work|samples of (?:your )?work|drive link|youtube channel)\b/i.test(t),
    linkedin: /\blinkedin\b/i.test(t),
  };
}

/**
 * True when the posting asks about hours, availability or start date.
 * @param {string} text
 */
export function detectAvailabilityAsked(text) {
  return /\b(?:hours?\s*(?:per|a|\/)\s*(?:week|day)|availability|available (?:for|from|to)|start date|immediate joiner|immediate joining|join immediately|can start)\b/i.test(String(text || ''));
}

/**
 * True when the posting asks the applicant for money.
 * @param {string} text
 */
export function detectFeeWarning(text) {
  return /\b(?:registration fee|processing fee|application fee|training fee|joining fee|security deposit|deposit of|refundable (?:fee|amount|deposit)|pay (?:a |an )?(?:small |nominal |one[- ]time )?(?:fee|amount|charge)|payment (?:of|required|is required)|pay (?:rs|₹|inr))\b/i.test(String(text || ''));
}

/**
 * Score families by title (x3) and description (x1) matches.
 * @param {string} title
 * @param {string} jdText
 * @returns {{primary: string, secondary: string|null, reason: string}}
 */
export function suggestFamily(title, jdText) {
  const t = String(title || '');
  const d = String(jdText || '');
  const scored = FAMILIES.filter((f) => f.id !== 'general').map((f) => {
    const terms = [...new Set([...f.titles, ...f.keywords])];
    const titleHits = terms.filter((term) => containsTerm(t, term));
    const descHits = terms.filter((term) => containsTerm(d, term));
    return { id: f.id, label: f.label, score: titleHits.length * 3 + descHits.length, titleHits, descHits };
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const top = scored[0];
  if (!top || top.score === 0) {
    return { primary: 'general', secondary: null, reason: 'No role-family keywords found in the title or description; using General.' };
  }
  const runner = scored[1];
  const secondary = runner && runner.score >= 2 && runner.score >= top.score * 0.6 ? runner.id : null;
  const parts = [];
  if (top.titleHits.length) parts.push(`title mentions ${top.titleHits.slice(0, 3).map((h) => `'${h}'`).join(', ')}`);
  if (top.descHits.length) parts.push(`description mentions ${top.descHits.slice(0, 4).map((h) => `'${h}'`).join(', ')}`);
  let reason = `${top.label}: ${parts.join('; ')}.`;
  if (secondary) reason += ` ${runner.label} also scored well (${runner.score} vs ${top.score}).`;
  return { primary: top.id, secondary, reason };
}

/**
 * Rules-only extraction of an Extraction object from a posting.
 * @param {{title?: string, jdText?: string}} input
 * @returns {object} Extraction
 */
export function extractFromText({ title = '', jdText = '' } = {}) {
  const text = String(jdText || '');
  const lines = toLines(text);
  const tagged = tagLines(lines);
  const { found, matchedLineIdx } = matchSkills(tagged);
  const extras = unmatchedBullets(tagged, matchedLineIdx, 10);
  const requirements = [...found, ...extras].map((r, i) => ({
    id: `req-${i + 1}`,
    text: r.text,
    canonicalSkill: r.canonicalSkill,
    priority: r.priority,
  }));

  const unreadable = [];
  if (text.trim().length < 80) unreadable.push('Job description is very short; requirements may be incomplete. Add any you know of.');
  if (text.trim().length >= 80 && requirements.length === 0) unreadable.push('No requirements could be identified automatically; add them manually.');

  return {
    requirements,
    workMode: detectWorkMode(text),
    location: detectLocation(text),
    duration: detectDuration(text),
    stipend: detectStipend(text),
    educationMentioned: detectEducation(text),
    linksRequested: detectLinks(text),
    designToolsMentioned: found.some((r) => r.designTool),
    availabilityAsked: detectAvailabilityAsked(text),
    feeWarning: detectFeeWarning(text),
    unreadable,
    suggestedFamily: suggestFamily(title, text),
  };
}

/**
 * An empty Extraction (used when a session has none yet).
 * @returns {object}
 */
export function emptyExtraction() {
  return {
    requirements: [],
    workMode: null,
    location: null,
    duration: null,
    stipend: null,
    educationMentioned: { degree: false, year: false, cgpa: false, coursework: false },
    linksRequested: { github: false, portfolio: false, linkedin: false },
    designToolsMentioned: false,
    availabilityAsked: false,
    feeWarning: false,
    unreadable: [],
    suggestedFamily: { primary: 'general', secondary: null, reason: '' },
  };
}
