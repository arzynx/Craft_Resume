/**
 * Small text helpers shared by the engine modules. No DOM, no I/O.
 */

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 * @returns {string}
 */
export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Build a case-insensitive, word-bounded regex for a term.
 * Uses lookarounds instead of \b so terms like "C/C++", "Node.js" or "UI/UX" work.
 * @param {string} term
 * @returns {RegExp}
 */
export function termRegex(term) {
  const body = escapeRegex(term).replace(/\s+/g, '[\\s-]+');
  return new RegExp(`(?<![A-Za-z0-9+#])${body}(?![A-Za-z0-9+#])`, 'i');
}

/**
 * True when `term` appears in `text` as a whole word (case-insensitive).
 * @param {string} text
 * @param {string} term
 * @returns {boolean}
 */
export function containsTerm(text, term) {
  if (!text || !term) return false;
  return termRegex(term).test(String(text));
}

/**
 * Return the first term from `terms` that appears in `text`, or null.
 * @param {string} text
 * @param {string[]} terms
 * @returns {string|null}
 */
export function firstTermIn(text, terms) {
  for (const t of terms) if (containsTerm(text, t)) return t;
  return null;
}

/**
 * Remove date-like tokens so remaining digits can be treated as "numbers".
 * Treats 19xx/20xx years, 'YYYY-MM', 'YYYY-MM-DD', 'MM/YYYY' and 'Mon YYYY' as dates.
 * @param {string} text
 * @returns {string}
 */
export function stripDates(text) {
  return String(text || '')
    .replace(/(?<!\d)(19|20)\d{2}-\d{2}(-\d{2})?(?!\d)/g, ' ')
    .replace(/(?<!\d)\d{1,2}\/(19|20)\d{2}(?!\d)/g, ' ')
    .replace(/(?<![\d.,])(19|20)\d{2}(?![\d.,%])/g, ' ');
}

/**
 * True when the text has a digit that is not part of a date.
 * @param {string} text
 * @returns {boolean}
 */
export function hasNonDateDigits(text) {
  return /\d/.test(stripDates(text));
}

/**
 * Digit sequences present in text after dates are removed.
 * @param {string} text
 * @returns {string[]}
 */
export function numberTokens(text) {
  return stripDates(text).match(/\d+(?:[.,]\d+)*/g) || [];
}

/**
 * First word of a sentence with surrounding punctuation removed.
 * @param {string} text
 * @returns {string}
 */
export function firstWord(text) {
  const m = String(text || '').trim().match(/^[^A-Za-z]*([A-Za-z][A-Za-z-]*)/);
  return m ? m[1] : '';
}

/**
 * Format a 'YYYY-MM' date as 'Mon YYYY'; 'present' becomes 'Present'. Unknown input is returned trimmed.
 * @param {string} value
 * @returns {string}
 */
export function formatMonth(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^present$/i.test(v)) return 'Present';
  const m = v.match(/^(\d{4})-(\d{1,2})/);
  if (!m) return v;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m[2]) - 1;
  return names[idx] ? `${names[idx]} ${m[1]}` : m[1];
}

/**
 * 'Jan 2025 - Present' style range. Empty parts are dropped.
 * @param {string} start
 * @param {string} end
 * @returns {string}
 */
export function formatRange(start, end) {
  const a = formatMonth(start);
  const b = formatMonth(end);
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

/**
 * Collapse whitespace and trim.
 * @param {string} s
 * @returns {string}
 */
export function clean(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/**
 * Split a body of text into trimmed, non-empty lines with bullet markers removed.
 * @param {string} text
 * @returns {string[]}
 */
export function toLines(text) {
  return String(text || '')
    .split(/\r?\n|(?<=\.)\s{2,}|\s[•●▪◦]\s/)
    .map((l) => l.replace(/^\s*(?:[-*•●▪◦–—●>]+|\d+[.)]|[a-z][.)])\s*/i, '').trim())
    .filter(Boolean);
}
