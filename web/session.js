// Tailoring-session helpers shared by the Tailor wizard, Saved and Rules views.
import { newId } from './core/schema.js';
import { loadProfile, loadSettings, updateSettings, getSession, upsertSession } from './store.js';
import { templateById, sameSkill, catalogLookup } from './catalog.js';

export const STEP_NAMES = ['Role', 'Review', 'Skills', 'Content', 'Preview', 'Approve'];

export function templateSpec(id = 'text_first') {
  const t = templateById(id);
  return { id: t.id, columns: t.columns, graphics: t.graphics, colour: t.colour };
}

export function emptyExtraction() {
  return {
    requirements: [], workMode: null, location: '', duration: '', stipend: '',
    educationMentioned: { degree: false, year: false, cgpa: false, coursework: false },
    linksRequested: { github: false, portfolio: false, linkedin: false },
    designToolsMentioned: false, feeWarning: false, unreadable: [],
    suggestedFamily: { primary: 'general', secondary: null, reason: '' }
  };
}

/** A fresh Session per the contract, plus a UI-only `ui` block (step, acknowledgements). */
export function newSession(partial = {}) {
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    role: { company: '', title: '', jdText: '', jdUrl: '', source: 'other', orgType: '', industry: '', note: '' },
    companyCheck: { status: 'not_checked', matches: [], chosen: null, note: '' },
    extraction: emptyExtraction(),
    family: { primary: 'general', secondary: null },
    confirmations: [],
    overlay: { skills: [] },
    selection: { entryIds: [], achievementIds: [], extracurricularIds: [], hobbyIds: [], includeAboutMe: false, aboutMeText: '' },
    linkOverrides: { linkedin: null, github: null, portfolio: null },
    bulletEdits: {},
    numberConfirmations: {},
    template: templateSpec('text_first'),
    approval: { approved: false, snapshotHash: null, approvedAt: null },
    ui: { step: 1, trimsAck: null, warned: {}, extractedFor: '', fetchError: null, mode: 'rules' },
    ...partial
  };
}

/** Fill in any missing blocks on a stored session (defensive). */
export function normalizeSession(s) {
  const base = newSession();
  const out = { ...base, ...s };
  for (const k of ['role', 'companyCheck', 'family', 'overlay', 'selection', 'linkOverrides', 'template', 'approval', 'ui']) {
    out[k] = { ...base[k], ...(s?.[k] || {}) };
  }
  out.extraction = { ...emptyExtraction(), ...(s?.extraction || {}) };
  if (!Array.isArray(out.extraction.requirements)) out.extraction.requirements = [];
  if (!Array.isArray(out.confirmations)) out.confirmations = [];
  if (!Array.isArray(out.overlay.skills)) out.overlay.skills = [];
  out.bulletEdits = s?.bulletEdits || {};
  out.numberConfirmations = s?.numberConfirmations || {};
  return out;
}

export function getCurrentSession() {
  const id = loadSettings().currentSessionId;
  const s = id ? getSession(id) : null;
  return s ? normalizeSession(s) : null;
}
export function setCurrentSession(id) { updateSettings({ currentSessionId: id }); }

export function saveSession(s) { upsertSession(s); return s; }

/** Any change after approval unlocks the snapshot. Returns true if approval was cleared. */
export function invalidateApproval(s) {
  if (s.approval?.approved) {
    s.approval = { approved: false, snapshotHash: null, approvedAt: null };
    return true;
  }
  return false;
}

/** Find a skill by name across the profile and the session overlay. */
export function findSkill(profile, session, name) {
  const n = String(name || '').trim();
  if (!n) return null;
  for (const sk of profile.skills || []) if (sameSkill(sk.name, n)) return { skill: sk, where: 'profile' };
  for (const sk of session?.overlay?.skills || []) if (sameSkill(sk.name, n)) return { skill: sk, where: 'overlay' };
  return null;
}

export function requirementSkillName(req) {
  return req.canonicalSkill || req.text || '';
}

/** Skill names confirmed as have/have_ai across profile + overlay. */
export function confirmedSkillNames(profile, session) {
  const out = [];
  for (const sk of [...(profile.skills || []), ...(session?.overlay?.skills || [])]) {
    if (sk.level === 'have' || sk.level === 'have_ai') out.push(sk.name);
  }
  return out;
}

const STOP = new Set(['the', 'and', 'or', 'of', 'to', 'in', 'a', 'an', 'with', 'for', 'on', 'at', 'by', 'is', 'are', 'be', 'as', 'you', 'we', 'our', 'your', 'will', 'must', 'have', 'has', 'good', 'strong', 'skills', 'skill', 'ability', 'knowledge', 'experience', 'working', 'work', 'basic', 'using', 'use', 'etc']);
function words(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Score profile items against the requirements. Returns a Map id -> { score, reasons: [] }.
 * Reason format: Matches 'event coordination' in the posting.
 */
export function recommend(profile, session) {
  const reqs = (session.extraction?.requirements || []).map((r) => ({ text: r.text, words: new Set(words(r.text + ' ' + (r.canonicalSkill || ''))), canonical: r.canonicalSkill }));
  const out = new Map();
  const scoreText = (id, text) => {
    const ws = new Set(words(text));
    let score = 0; const reasons = [];
    for (const r of reqs) {
      let hit = 0;
      for (const w of r.words) if (ws.has(w)) hit++;
      if (r.canonical && String(text).toLowerCase().includes(String(r.canonical).toLowerCase())) hit += 2;
      if (hit > 0) { score += hit; reasons.push(`Matches '${r.canonical || r.text}' in the posting`); }
    }
    out.set(id, { score, reasons: reasons.slice(0, 2) });
  };
  for (const e of profile.entries || []) scoreText(e.id, [e.title, e.organization, e.role, ...(e.bullets || []).map((b) => b.text), e.result?.text].join(' '));
  for (const a of profile.achievements || []) scoreText(a.id, [a.name, a.detail].join(' '));
  for (const x of profile.extracurriculars || []) scoreText(x.id, [x.name, x.detail].join(' '));
  for (const hb of profile.hobbies || []) scoreText(hb.id, [hb.name, hb.detail].join(' '));
  return out;
}

/** Order ids by recommendation score (stable). */
export function orderByScore(items, scores) {
  return [...items].sort((a, b) => (scores.get(b.id)?.score || 0) - (scores.get(a.id)?.score || 0));
}

/** Private summary text file content. */
export function privateSummaryText(summary, session, profile) {
  const lines = [];
  lines.push('PRIVATE, DO NOT SEND');
  lines.push(`Match summary for ${session.role.title || 'role'} at ${session.role.company || 'company'}`);
  lines.push(`Generated ${new Date().toLocaleString()} by Resum.me`);
  lines.push('');
  lines.push('Requirements');
  for (const r of summary.requirements || []) {
    const mark = r.status === 'met' ? 'Met' : r.status === 'partial' ? 'Partly met (exposure)' : 'Not met';
    lines.push(`- [${mark}] ${r.text}${r.via ? ` (via ${r.via})` : ''}`);
  }
  lines.push('');
  lines.push(`Work-mode fit: ${typeof summary.workModeFit === 'string' ? summary.workModeFit : JSON.stringify(summary.workModeFit)}`);
  const ver = summary.verification;
  if (ver && typeof ver === 'object') {
    lines.push(`Verification: ${ver.companyCheck || ''}${ver.companyNote ? ' - ' + ver.companyNote : ''}`);
    if (ver.sourceUnverified || ver.feeWarning) lines.push(`Flag: ${ver.sourceUnverified ? 'Unverified source' : 'Fee warning'}${ver.sourceLabel ? ' (' + ver.sourceLabel + ')' : ''}. ${ver.caution || ''}`.trim());
  } else {
    lines.push(`Verification: ${typeof ver === 'string' ? ver : JSON.stringify(ver)}`);
    if (['telegram_whatsapp', 'email_dm'].includes(session.role.source)) lines.push('Flag: Unverified source. Never pay a fee to apply. Verify the company independently before sharing documents.');
  }
  lines.push('');
  lines.push('Interview prep: lines most likely to be asked about');
  for (const p of summary.interviewPrep || []) lines.push(`- ${p}`);
  if (summary.sparse) { lines.push(''); lines.push('Note: your profile is sparse. A half-page resume is fine; add genuine detail when you have it.'); }
  lines.push('');
  lines.push(`Profile: ${profile.basics?.fullName || ''}`);
  return lines.join('\n');
}

export { catalogLookup };
