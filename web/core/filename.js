/**
 * Resume file naming: Firstname-Lastname-Company-Role.pdf (ASCII-safe).
 */

/**
 * Make one ASCII-safe, hyphenated token: strips diacritics, replaces other characters with hyphens,
 * collapses runs of hyphens and trims them from the ends.
 * @param {string} s
 * @returns {string}
 */
export function safeToken(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build the PDF file name for a tailored resume.
 * @param {object} profile
 * @param {object} session
 * @returns {string} e.g. 'Asha-Rao-Acme-Video-Editor.pdf', falls back to 'Resume.pdf'
 */
export function resumeFileName(profile, session) {
  const fullName = String(profile?.basics?.fullName || '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const first = nameParts[0] || '';
  const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const company = session?.role?.company || '';
  const title = session?.role?.title || '';
  const parts = [first, last, company, title].map(safeToken).filter(Boolean);
  const base = parts.join('-').replace(/-+/g, '-');
  return `${base || 'Resume'}.pdf`;
}
