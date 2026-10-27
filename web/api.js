// Edge-function client. Every call returns null when no backend is configured
// or on any network/HTTP error, so callers always fall back to rules-only.
import { CONFIG, functionsUrl, hasBackend } from './config.js';
import { extractFromText, suggestFamily } from './core/extract.js';
import { loadProfile } from './store.js';

async function authToken() {
  if (!hasBackend()) return null;
  try {
    if (loadProfile().settings?.syncEnabled) {
      const { getAccessToken } = await import('./sync.js');
      const t = await getAccessToken();
      if (t) return t;
    }
  } catch (e) { /* fall through to anon */ }
  return CONFIG.SUPABASE_ANON_KEY || null;
}

/**
 * POST JSON to FUNCTIONS_URL/<name>. Returns the parsed JSON, or null when the
 * backend is not configured, the request fails, or the response is not ok.
 */
export async function callFunction(name, body, { timeoutMs = 25000 } = {}) {
  const base = functionsUrl();
  const token = await authToken();
  if (!base || !token) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`callFunction(${name}) failed`, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extraction with graceful fallback to the rules-only engine. */
export async function extractRequirements({ title, jdText, useAI = false }) {
  let result = null;
  if (useAI || hasBackend()) {
    result = await callFunction('extract', { title, jdText, useAI: Boolean(useAI) });
  }
  if (result && result.extraction) return { extraction: result.extraction, mode: result.mode || 'rules' };
  let extraction;
  try { extraction = extractFromText({ title, jdText }); } catch (e) {
    console.error('extractFromText failed', e);
    extraction = { requirements: [], workMode: null, location: '', duration: '', stipend: '',
      educationMentioned: { degree: false, year: false, cgpa: false, coursework: false },
      linksRequested: { github: false, portfolio: false, linkedin: false }, designToolsMentioned: false,
      feeWarning: false, unreadable: ['Could not run extraction.'], suggestedFamily: null };
  }
  if (!extraction.suggestedFamily) {
    try { extraction.suggestedFamily = suggestFamily(title, jdText); } catch (e) { extraction.suggestedFamily = { primary: 'general', secondary: null, reason: '' }; }
  }
  return { extraction, mode: 'rules' };
}

/**
 * Fetch a posting by URL. Returns { ok, text, title } / { ok:false, reason, message }.
 * Never returns null: offline becomes a clear 'blocked' explanation.
 */
export async function fetchPosting(url) {
  const r = await callFunction('fetch-posting', { url });
  if (r && typeof r.ok === 'boolean') return r;
  return { ok: false, reason: 'blocked', message: hasBackend()
    ? 'The link could not be fetched right now (network error).'
    : 'Link fetching needs the optional backend; this build runs offline. Paste the job description text instead.' };
}

/** Company check; 'not_checked' when offline / rules-only. */
export async function verifyCompany(name) {
  const r = await callFunction('verify-company', { name });
  if (r && r.status) return { status: r.status, matches: r.matches || [], chosen: null, note: r.note || '' };
  return { status: 'not_checked', matches: [], chosen: null,
    note: hasBackend() ? 'The check could not run (network error).' : 'Not checked: offline or rules-only mode.' };
}

/** Optional AI reword. Returns { bullets, mode } or null. */
export async function rewordBullets({ bullets, confirmedSkills, family }) {
  const r = await callFunction('reword', { bullets, confirmedSkills, family });
  return r && Array.isArray(r.bullets) ? r : null;
}
