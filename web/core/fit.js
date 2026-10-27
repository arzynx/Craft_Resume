/**
 * One-page fitting: character-based line estimate and the fixed trim order (SPEC section 13.1).
 * The browser does real measurement; this module decides *what* to trim and records every trim.
 */
import { TRIM_ORDER } from './data.js';

export { TRIM_ORDER };

/** Approximate body lines that fit on one page at 10.5 pt with 0.6 in margins. */
export const PAGE_LINE_BUDGET = { A4: 52, Letter: 50 };

/** Characters per printed body line used by the estimate. */
export const CHARS_PER_LINE = 95;

const clone = (m) => JSON.parse(JSON.stringify(m));
const findSection = (model, key) => model.sections.find((s) => s.key === key);
const dropSection = (model, key) => { model.sections = model.sections.filter((s) => s.key !== key); };

function trimSection(model, key, reason) {
  if (!findSection(model, key)) return null;
  const title = findSection(model, key).title || key;
  dropSection(model, key);
  return { kind: key, what: `Removed the ${title} section`, reason };
}

function trimExtracurricular(model) {
  const sec = findSection(model, 'extracurriculars');
  if (!sec || !sec.items.length) return null;
  const last = sec.items.pop();
  if (!sec.items.length) dropSection(model, 'extracurriculars');
  return { kind: 'extracurricular_item', what: `Removed extracurricular "${last.heading || last.id}"`, reason: 'Lowest-ranked extracurricular trimmed to fit one page', itemId: last.id };
}

function trimBullets(model) {
  const items = model.sections.filter((s) => s.key === 'experience' || s.key === 'projects').flatMap((s) => s.items);
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const bulletIdx = item.lines.map((l, idx) => (l.src && l.src.type === 'bullet' ? idx : -1)).filter((idx) => idx >= 0);
    if (bulletIdx.length <= 2) continue;
    const removeAt = bulletIdx[bulletIdx.length - 1];
    const [removed] = item.lines.splice(removeAt, 1);
    return { kind: 'entry_bullets', what: `Removed bullet ${bulletIdx.length} from "${item.heading || item.id}"`, reason: 'Third and fourth bullets on lower-ranked entries are trimmed to fit one page', lineId: removed.id };
  }
  return null;
}

/**
 * Apply the next trim in the fixed order. Returns a new model (input is not mutated) and the trim record,
 * or `{ model, trim: null }` when nothing is left to trim.
 * @param {object} model ResumeModel
 * @returns {{ model: object, trim: {step:number, what:string, reason:string}|null }}
 */
export function applyNextTrim(model) {
  const next = clone(model);
  next.trims = Array.isArray(next.trims) ? next.trims : [];
  const trim =
    trimSection(next, 'hobbies', 'Hobbies are the first section trimmed to fit one page') ||
    trimSection(next, 'languages', 'Languages are trimmed after hobbies to fit one page') ||
    trimExtracurricular(next) ||
    trimBullets(next) ||
    trimSection(next, 'about', 'About Me is the last section trimmed to fit one page');
  if (!trim) return { model: next, trim: null };
  trim.step = next.trims.length + 1;
  next.trims.push(trim);
  return { model: next, trim };
}

/**
 * Rough count of printed lines: each text line is ceil(chars / 95), plus headings, subs and section titles.
 * @param {object} model ResumeModel
 * @returns {number}
 */
export function estimateLines(model) {
  const h = (model && model.header) || {};
  let n = h.name ? 1 : 0;
  if (h.headline) n += 1;
  if (h.contactLine && h.contactLine.length) n += 1;
  if (h.links && h.links.length) n += 1;
  for (const section of (model && model.sections) || []) {
    n += 2; // section title + spacing
    for (const item of section.items || []) {
      if (item.heading) n += 1;
      if (item.sub && item.heading && (item.sub.length + item.heading.length + (item.dateRange || '').length) > CHARS_PER_LINE) n += 1;
      for (const line of item.lines || []) n += Math.max(1, Math.ceil((line.text || '').length / CHARS_PER_LINE));
    }
  }
  return n;
}

/**
 * Apply trims until the estimate fits the page budget or nothing is left to trim.
 * @param {object} model ResumeModel
 * @returns {{ model: object, trims: object[] }}
 */
export function fitToOnePage(model) {
  let current = model;
  const budget = PAGE_LINE_BUDGET[current.pageSize] || PAGE_LINE_BUDGET.A4;
  const applied = [];
  while (estimateLines(current) > budget) {
    const { model: next, trim } = applyNextTrim(current);
    if (!trim) break;
    applied.push(trim);
    current = next;
  }
  return { model: current, trims: applied };
}
