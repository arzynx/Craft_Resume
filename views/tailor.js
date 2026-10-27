// Tailor: 6-step wizard. State lives in hr.sessions; current id in hr.settings.
import { h, clear, field, bindInput, choiceGroup, toast, modal, confirmDialog, tipsCard, charCounter, downloadText, formatDate } from '../ui.js';
import { loadProfile, saveProfile, loadSettings, updateSettings, loadSessions, deleteSession, addSnapshot, isProfileSparse, isProfileEmpty } from '../store.js';
import { newId } from '../core/schema.js';
import { buildResume } from '../core/tailor.js';
import { checkIntegrity } from '../core/integrity.js';
import { applyNextTrim } from '../core/fit.js';
import { buildMatchSummary } from '../core/match.js';
import { resumeFileName } from '../core/filename.js';
import { snapshotHash } from '../core/hash.js';
import { extractRequirements, fetchPosting, verifyCompany } from '../api.js';
import { renderResume, printModel, formatDateRange } from '../render.js';
import { SOURCES, ORG_TYPES, INDUSTRIES, FAMILIES, TEMPLATES, VERBS_FLAT, VERB_GROUPS, LEVELS, levelLabel, labelOf, catalogLookup } from '../catalog.js';
import { STEP_NAMES, newSession, normalizeSession, getCurrentSession, setCurrentSession, saveSession, invalidateApproval, findSkill,
  requirementSkillName, recommend, orderByScore, privateSummaryText, templateSpec } from '../session.js';
import { comparisonTable, atsChecklist } from './rules.js';

const URL_RE = /^(https?:\/\/)[^\s]+$/i;
const UNVERIFIED_SOURCES = ['telegram_whatsapp', 'email_dm'];
const UNVERIFIED_TEXT = 'Never pay a fee to apply. Verify the company independently before sharing documents.';

export function renderTailor(view) {
  clear(view);
  const session = getCurrentSession();
  if (!session) return renderStart(view);
  new Wizard(view, session).render();
}

// ---------- Start screen ----------
function renderStart(view) {
  const profile = loadProfile();
  view.append(h('div', { class: 'page-title' }, h('h1', null, 'Tailor a resume'),
    h('span', { class: 'muted small' }, 'One role at a time. Under 10 minutes once your profile is ready.')));
  if (isProfileEmpty(profile)) {
    view.append(h('div', { class: 'card notice' }, h('p', null, h('strong', null, 'Start with your master profile. '), 'Tailoring selects from what is there; nothing is invented.'),
      h('a', { class: 'btn primary', href: '#/profile' }, 'Go to Profile')));
  }
  const sessions = loadSessions().filter((s) => !s.approval?.approved || true);
  const start = h('button', { type: 'button', class: 'btn primary', onclick: () => { const s = newSession(); saveSession(s); setCurrentSession(s.id); renderTailor(view); } }, 'Start a new tailoring session');
  view.append(h('div', { class: 'card' }, h('p', null, 'Enter the company, role and job description. The tool extracts requirements, asks only about what is new, and shows a full preview before anything is generated.'), start));
  if (sessions.length) {
    const list = h('div', { class: 'card' }, h('h2', null, 'In progress'));
    for (const s of sessions.slice().reverse()) {
      list.append(h('div', { class: 'row between', style: { padding: '.4rem 0', borderTop: '1px solid var(--border)' } },
        h('span', null, h('strong', null, s.role?.title || 'Untitled role'), ' at ', s.role?.company || '?', ' ', h('span', { class: 'muted small' }, `step ${s.ui?.step || 1}, ${formatDate(s.createdAt)}`), s.approval?.approved ? h('span', { class: 'badge rec' }, ' approved') : null),
        h('span', { class: 'row' },
          h('button', { type: 'button', class: 'btn small', onclick: () => { setCurrentSession(s.id); renderTailor(view); } }, 'Resume'),
          h('button', { type: 'button', class: 'btn small danger', onclick: async () => { if (await confirmDialog('Delete this session?', 'Approved snapshots in Saved are not affected.', { okLabel: 'Delete', danger: true })) { deleteSession(s.id); renderTailor(view); } } }, 'Delete'))));
    }
    view.append(list);
  }
}

// ---------- Wizard ----------
class Wizard {
  constructor(view, session) {
    this.view = view;
    this.s = session;
    this.profile = loadProfile();
    this.built = null; // { model, trims, overflow, integrity, summary, error }
    this.cleanups = [];
  }

  /** Register a global listener so the next render can remove it. */
  listen(target, type, fn) { target.addEventListener(type, fn); this.cleanups.push(() => target.removeEventListener(type, fn)); }

  save() { saveSession(this.s); }
  /** Any content change: invalidates approval, saves, drops the cached build. */
  touch() {
    if (invalidateApproval(this.s)) { this.s.ui.reapprove = true; toast('Re-approve needed: the resume changed after approval.', { kind: 'warn' }); }
    this.built = null;
    this.save();
  }
  go(step) { this.s.ui.step = Math.max(1, Math.min(6, step)); this.save(); this.render(); window.scrollTo({ top: 0 }); }

  render() {
    const view = this.view;
    for (const c of this.cleanups.splice(0)) c();
    clear(view);
    const step = this.s.ui.step || 1;
    view.append(h('div', { class: 'page-title' }, h('h1', null, 'Tailor'),
      h('span', { class: 'muted small' }, this.s.role.title ? `${this.s.role.title} at ${this.s.role.company || '?'}` : 'New session'),
      h('button', { type: 'button', class: 'btn link small', onclick: () => { setCurrentSession(null); renderTailor(view); } }, 'All sessions')));
    view.append(this.progress(step));
    if (this.s.ui.reapprove && !this.s.approval.approved) view.append(h('div', { class: 'card warn' }, h('strong', null, 'Re-approve needed. '), 'Something changed after approval, so the snapshot is unlocked. Review the preview and approve again in step 6.'));
    const body = h('div', { class: 'wizard-body' });
    view.append(body);
    const nav = h('div', { class: 'wizard-nav' });
    view.append(nav);
    const fns = [null, this.step1, this.step2, this.step3, this.step4, this.step5, this.step6];
    fns[step].call(this, body, nav);
  }

  progress(step) {
    return h('div', { class: 'progress', role: 'group', 'aria-label': `Step ${step} of 6: ${STEP_NAMES[step - 1]}` },
      h('div', { class: 'progress-bar' }, h('div', { style: { width: `${(step / 6) * 100}%` } })),
      h('ol', null, STEP_NAMES.map((n, i) => h('li', { class: i + 1 < step ? 'done' : i + 1 === step ? 'current' : '', 'aria-current': i + 1 === step ? 'step' : null }, `${i + 1}. ${n}`))));
  }

  navButtons(nav, { back = true, next = 'Next', onNext, nextDisabled = false } = {}) {
    clear(nav);
    const b = h('button', { type: 'button', class: 'btn', disabled: !back, onclick: () => this.go(this.s.ui.step - 1) }, 'Back');
    const n = onNext ? h('button', { type: 'button', class: 'btn primary', disabled: nextDisabled, onclick: async () => {
      n.disabled = true; const label = n.textContent; n.textContent = 'Working...';
      try { await onNext(); } catch (e) { console.error(e); toast('Something went wrong: ' + (e && e.message), { kind: 'danger' }); }
      n.disabled = false; n.textContent = label;
    } }, next) : h('span');
    nav.append(b, n);
    return { back: b, next: n };
  }

  // ---------- Step 1: Role input ----------
  step1(body, nav) {
    const r = this.s.role;
    const company = bindInput(r, 'company', { onInput: () => this.save(), attrs: { autocomplete: 'organization' } });
    const title = bindInput(r, 'title', { onInput: () => this.save() });
    const companyF = field('Company or organization name', company, { required: true });
    const titleF = field('Role title', title, { required: true });

    const jdWrap = h('div');
    const renderJd = () => {
      clear(jdWrap);
      const err = this.s.ui.fetchError;
      if (r.jdUrl && err) {
        const reasons = { dead: 'The link appears to be dead.', login: 'The page is behind a login.', paywall: 'The page is behind a paywall.', expired: 'The posting has expired.', no_description: 'The page has no usable description.', blocked: 'The page could not be fetched.' };
        jdWrap.append(h('div', { class: 'card warn' }, h('p', null, h('strong', null, reasons[err.reason] || 'Could not read the link. '), ' ', err.message || ''),
          h('p', { class: 'small muted' }, 'Link: ', r.jdUrl, ' ', h('button', { type: 'button', class: 'btn link small', onclick: () => { r.jdUrl = ''; this.s.ui.fetchError = null; this.save(); renderJd(); } }, 'Use a different link'))));
        const ta = bindInput(r, 'jdText', { textarea: true, onInput: () => this.save(), attrs: { rows: '8' } });
        jdWrap.append(field('Paste the job description text', ta, { hint: 'Copy the text from the posting and paste it here.', required: true }));
      } else {
        const ta = bindInput(r, 'jdText', { textarea: true, placeholder: 'Paste the job description text, or paste a link to the posting', onInput: () => this.save(), attrs: { rows: '8' } });
        jdWrap.append(field('Job description', ta, { hint: r.jdUrl ? `Fetched from ${r.jdUrl}` : 'One box: paste the text or paste a link. A link is fetched when you tap Next.' }));
      }
    };
    renderJd();

    body.append(h('div', { class: 'layout with-side' },
      h('div', { class: 'card' },
        h('h2', null, 'Step 1: Role'),
        h('div', { class: 'grid-2' }, companyF, titleF),
        jdWrap,
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Where did you find this posting?'),
          choiceGroup({ label: 'Posting source', options: SOURCES, value: r.source || 'other', allowNone: false, onChange: (v) => { r.source = v; this.save(); } })),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Organization type (optional)'),
          choiceGroup({ label: 'Organization type', options: ORG_TYPES, value: r.orgType || null, onChange: (v) => { r.orgType = v || ''; this.save(); } })),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Industry (optional)'),
          choiceGroup({ label: 'Industry', options: INDUSTRIES, value: r.industry || null, onChange: (v) => { r.industry = v || ''; this.save(); } })),
        field('Anything else about this company? (optional)', bindInput(r, 'note', { textarea: true, onInput: () => this.save(), attrs: { rows: '2' } }), { hint: 'Context only; not treated as verification.' })),
      tipsCard(['Paste the full posting: more text means better extraction.', 'Organization type and industry only adjust tone and emphasis; they never add content.', 'Postings from Telegram, WhatsApp, email or DM get an "Unverified source" flag. Never pay a fee to apply.'])));

    this.navButtons(nav, { back: false, next: 'Next: review', onNext: async () => {
      let ok = true;
      companyF.setError(r.company.trim() ? '' : 'Required'); titleF.setError(r.title.trim() ? '' : 'Required');
      if (!r.company.trim() || !r.title.trim()) return;
      const text = (r.jdText || '').trim();
      if (URL_RE.test(text)) {
        r.jdUrl = text; r.jdText = '';
        const res = await fetchPosting(text);
        if (res.ok) { r.jdText = res.text || ''; if (!r.title.trim() && res.title) r.title = res.title; this.s.ui.fetchError = null; }
        else { this.s.ui.fetchError = { reason: res.reason, message: res.message }; this.save(); renderJd(); toast('Could not read the link. Paste the text instead.', { kind: 'warn' }); return; }
      }
      if (!(r.jdText || '').trim()) {
        ok = await confirmDialog('No job description', 'Without a description the tool can only use the role title. Continue anyway?', { okLabel: 'Continue' });
        if (!ok) return;
      }
      // Extraction (cached per title + text)
      const key = `${r.title}\n${r.jdText}`;
      if (this.s.ui.extractedFor !== key) {
        const { extraction, mode } = await extractRequirements({ title: r.title, jdText: r.jdText, useAI: Boolean(this.profile.settings?.aiEnabled) });
        extraction.requirements = (extraction.requirements || []).map((q) => ({ id: q.id || newId(), text: q.text || '', canonicalSkill: q.canonicalSkill ?? null, priority: q.priority || 'unknown' }));
        this.s.extraction = extraction;
        const fam = extraction.suggestedFamily || { primary: 'general', secondary: null };
        this.s.family = { primary: fam.primary || 'general', secondary: fam.secondary || null };
        this.s.ui.extractedFor = key; this.s.ui.mode = mode;
        this.touch();
      }
      if (this.s.companyCheck.checkedFor !== r.company.trim()) {
        const c = await verifyCompany(r.company.trim());
        this.s.companyCheck = { ...c, checkedFor: r.company.trim() };
      }
      this.go(2);
    } });
  }

  // ---------- Step 2: verification + extraction review ----------
  step2(body, nav) {
    const s = this.s; const ex = s.extraction; const cc = s.companyCheck;
    const main = h('div', { class: 'stack' });

    // Company check
    const statusText = { found: 'Company found', multiple: 'Multiple matches, pick one', could_not_confirm: 'Could not confirm', not_checked: 'Not checked' }[cc.status] || cc.status;
    const check = h('div', { class: 'card' }, h('h2', null, 'Company check'),
      h('p', null, h('span', { class: 'badge ' + (cc.status === 'found' ? 'rec' : cc.status === 'not_checked' ? '' : 'care') }, statusText), ' ', cc.note || ''));
    if (cc.status === 'multiple' && cc.matches?.length) {
      check.append(choiceGroup({ label: 'Pick the right organization', options: cc.matches.map((m, i) => ({ value: String(i), label: m.name + (m.domain ? ` (${m.domain})` : ''), hint: m.source })), value: cc.chosen != null ? String(cc.chosen) : null, onChange: (v) => { cc.chosen = v == null ? null : Number(v); this.save(); } }));
    } else if (cc.status === 'found' && cc.matches?.length) {
      check.append(h('ul', null, cc.matches.map((m) => h('li', null, m.name, m.domain ? ` (${m.domain})` : '', m.source ? h('span', { class: 'muted small' }, ` via ${m.source}`) : null))));
    }
    check.append(h('p', { class: 'small muted' }, 'This check only looks at whether an organization with this name appears to exist (official website, public registry, well-known listing). It does not confirm that the posting is genuine or current, or that a recruiter is authorized.'));
    if (UNVERIFIED_SOURCES.includes(s.role.source)) check.append(h('div', { class: 'card warn' }, h('strong', null, 'Unverified source. '), UNVERIFIED_TEXT));
    if (ex.feeWarning) check.append(h('div', { class: 'card danger' }, h('strong', null, 'This posting asks for a payment. '), 'Never pay a fee to apply. Genuine employers do not charge candidates.'));
    main.append(check);

    // Family
    const famCard = h('div', { class: 'card' }, h('h2', null, 'Role family'),
      ex.suggestedFamily?.reason ? h('p', { class: 'muted small' }, 'Suggested: ', labelOf(FAMILIES, ex.suggestedFamily.primary), '. ', ex.suggestedFamily.reason) : null,
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Primary'), choiceGroup({ label: 'Primary family', options: FAMILIES, value: s.family.primary, allowNone: false, onChange: (v) => { s.family.primary = v; if (s.family.secondary === v) s.family.secondary = null; this.touch(); } })),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Secondary (optional, for mixed roles)'), choiceGroup({ label: 'Secondary family', options: FAMILIES, value: s.family.secondary, onChange: (v) => { s.family.secondary = v && v !== s.family.primary ? v : null; this.touch(); } })),
      h('p', { class: 'small muted' }, 'Primary sets the section order; a secondary family can pull in one extra relevant section or link.'));
    main.append(famCard);

    // Requirements (editable)
    const reqCard = h('div', { class: 'card' }, h('h2', null, 'Requirements'), h('p', { class: 'muted small' }, `Extracted (${s.ui.mode === 'ai+rules' ? 'AI + rules' : 'rules-only'}). Edit the text, remove what is wrong, add what is missing, and tag Must-have vs Nice-to-have.`));
    const list = h('div');
    const PRI = { must: 'Must-have', nice: 'Nice-to-have', unknown: 'Unsorted' };
    const renderReqs = () => {
      clear(list);
      if (!ex.requirements.length) list.append(h('p', { class: 'muted' }, 'Nothing extracted yet. Add requirements by hand below.'));
      for (const q of ex.requirements) {
        const inp = h('input', { type: 'text', value: q.text, 'aria-label': 'Requirement text' });
        inp.addEventListener('input', () => { q.text = inp.value; if (!q.canonicalSkill) { const c = catalogLookup(inp.value); q.canonicalSkill = c ? c.name : null; } this.touch(); });
        const next = { must: 'nice', nice: 'unknown', unknown: 'must' };
        const pri = h('button', { type: 'button', class: 'chip', 'aria-pressed': q.priority === 'must' ? 'true' : 'false', title: 'Tap to change', onclick: () => { q.priority = next[q.priority] || 'must'; this.touch(); renderReqs(); } }, PRI[q.priority] || 'Unsorted');
        list.append(h('div', { class: 'req' }, h('div', null, inp, q.canonicalSkill ? h('span', { class: 'muted small' }, 'Skill: ' + q.canonicalSkill) : null),
          h('span', { class: 'row' }, pri, h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove requirement', onclick: () => { ex.requirements = ex.requirements.filter((x) => x !== q); this.touch(); renderReqs(); } }, 'Remove'))));
      }
    };
    renderReqs();
    const addInp = h('input', { type: 'text', placeholder: 'Add a requirement', 'aria-label': 'New requirement' });
    const add = () => { const t = addInp.value.trim(); if (!t) return; const c = catalogLookup(t); ex.requirements.push({ id: newId(), text: t, canonicalSkill: c ? c.name : null, priority: 'unknown' }); addInp.value = ''; this.touch(); renderReqs(); };
    addInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    reqCard.append(list, h('div', { class: 'row', style: { marginTop: '.5rem' } }, addInp, h('button', { type: 'button', class: 'btn', onclick: add }, 'Add')));
    main.append(reqCard);

    // Private facts
    const yesno = (b) => (b ? 'yes' : 'no');
    const facts = h('div', { class: 'card private' }, h('h2', null, 'Extracted facts ', h('span', { class: 'badge private' }, 'private')),
      h('dl', { class: 'small' },
        h('dt', null, 'Work mode'), h('dd', null, ex.workMode || 'not stated'),
        h('dt', null, 'Location'), h('dd', null, ex.location || 'not stated'),
        h('dt', null, 'Duration'), h('dd', null, ex.duration || 'not stated'),
        h('dt', null, 'Stipend'), h('dd', null, ex.stipend || 'not stated'),
        h('dt', null, 'Education mentioned'), h('dd', null, Object.entries(ex.educationMentioned || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'),
        h('dt', null, 'Links requested'), h('dd', null, Object.entries(ex.linksRequested || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'),
        h('dt', null, 'Design tools mentioned'), h('dd', null, yesno(ex.designToolsMentioned))),
      ex.unreadable?.length ? h('div', null, h('strong', { class: 'small' }, 'Could not be read or verified:'), h('ul', { class: 'small' }, ex.unreadable.map((u) => h('li', null, u)))) : null,
      h('p', { class: 'muted small' }, 'These go to your private match summary only; nothing here is printed.'));
    main.append(facts);

    body.append(h('div', { class: 'layout with-side' }, main, tipsCard(['Must-have vs Nice-to-have changes nothing on the resume; it sharpens the private summary.', 'If a requirement is not really a skill (e.g. "available 20 hrs/week"), leave it: step 3 lets you skip it.', 'Campus clubs and individuals often cannot be verified; that is fine, tailoring continues.'])));
    this.navButtons(nav, { next: 'Next: skills', onNext: () => this.go(3) });
  }

  // ---------- Step 3: skill confirmation ----------
  step3(body, nav) {
    const s = this.s; const profile = this.profile;
    const main = h('div', { class: 'card' }, h('h2', null, 'Step 3: Confirm skills'),
      h('p', { class: 'muted small' }, 'Only requirements that are new or conflicting need an answer. Nothing is printed without a level you picked.'));
    const list = h('div');
    const render = () => {
      clear(list);
      const reqs = s.extraction.requirements;
      if (!reqs.length) list.append(h('p', { class: 'muted' }, 'No requirements to confirm.'));
      for (const q of reqs) {
        const name = requirementSkillName(q);
        const conf = s.confirmations.find((c) => c.reqId === q.id);
        const found = findSkill(profile, s, name);
        list.append(this.reqRow(q, name, found, conf, render));
      }
    };
    render();
    main.append(list);
    body.append(h('div', { class: 'layout with-side' }, main, tipsCard(['"Have this" needs a private one-line note on where you used it. Coursework, a practice project, a club task or self-learning all count.', '"Some exposure" prints only in the Skills list as "Exposure: name (note)", never inside a bullet.', '"Only for this resume" keeps the skill out of your master profile.'])));
    this.navButtons(nav, { next: 'Next: content', onNext: () => this.go(4) });
  }

  reqRow(q, name, found, conf, rerender) {
    const s = this.s; const profile = this.profile;
    const row = h('div', { class: 'skill-row' });
    const head = h('div', { class: 'row between' }, h('span', null, h('span', { class: 'name' }, name), ' ', h('span', { class: 'muted small' }, q.priority === 'must' ? 'must-have' : q.priority === 'nice' ? 'nice-to-have' : '')));
    row.append(head);
    const formWrap = h('div');
    row.append(formWrap);
    const existing = found?.skill;
    const confirmedLevel = conf ? conf.level : existing?.level;
    const conflicting = existing && q.priority === 'must' && (existing.level === 'exposure' || existing.level === 'none');
    const openForm = (prefill) => { clear(formWrap); formWrap.append(this.skillMiniForm(q, name, prefill, found, () => { rerender(); })); };

    if ((existing && existing.level != null) || conf) {
      const where = found?.where === 'overlay' || (conf && !conf.saveToProfile) ? ' (this resume only)' : '';
      head.append(h('span', { class: 'row' }, h('span', { class: conflicting ? 'status-partial' : 'status-met' }, `Already in your profile, ${levelLabel(confirmedLevel)}${where}`),
        h('button', { type: 'button', class: 'btn small', onclick: () => openForm({ level: confirmedLevel, aiAssisted: confirmedLevel === 'have_ai', whereUsed: conf?.whereUsed ?? existing?.whereUsed ?? '', exposureNote: existing?.exposureNote || '', saveToProfile: conf ? conf.saveToProfile : true }) }, 'Change')));
      if (conflicting) row.append(h('p', { class: 'small status-partial' }, 'The posting marks this as a must-have. Your profile says "' + levelLabel(existing.level) + '". Keep it honest; it will show as not met / partly met in your private summary.'));
      return row;
    }
    // Not in profile: tap-to-choose
    formWrap.append(choiceGroup({ label: 'Do you have ' + name + '?', options: [{ value: 'have', label: 'Have this' }, { value: 'exposure', label: 'Some exposure' }, { value: 'none', label: "Don't have this" }],
      onChange: (v) => { if (!v) return; if (v === 'none') { this.recordConfirmation(q, name, { level: 'none', aiAssisted: false, whereUsed: '', exposureNote: '', saveToProfile: false }, found); rerender(); } else openForm({ level: v, aiAssisted: false, whereUsed: '', exposureNote: '', saveToProfile: null }); } }));
    return row;
  }

  skillMiniForm(q, name, pre, found, done) {
    const state = { level: pre.level === 'have_ai' ? 'have' : (pre.level || 'have'), aiAssisted: Boolean(pre.aiAssisted), whereUsed: pre.whereUsed || '', exposureNote: pre.exposureNote || '', saveToProfile: pre.saveToProfile };
    const box = h('div', { class: 'card', style: { marginTop: '.5rem' } });
    const detail = h('div');
    const where = h('input', { type: 'text', value: state.whereUsed, placeholder: 'e.g. Edited 6 reels for the college fest page' });
    const whereF = field('Where I used it (private)', where, { hint: 'Never printed.' });
    where.addEventListener('input', () => { state.whereUsed = where.value; whereF.setError(''); });
    const note = h('input', { type: 'text', value: state.exposureNote, placeholder: 'e.g. reading level' });
    note.addEventListener('input', () => { state.exposureNote = note.value; });
    const renderDetail = () => {
      clear(detail);
      if (state.level === 'have') {
        detail.append(h('div', { class: 'field' }, h('span', { class: 'label' }, 'AI-assisted?'), choiceGroup({ label: 'AI-assisted', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes, AI-assisted' }], value: state.aiAssisted ? 'yes' : 'no', allowNone: false, onChange: (v) => { state.aiAssisted = v === 'yes'; } }),
          h('span', { class: 'hint' }, 'AI-assisted skills print under an "AI-assisted" label, exactly as written.')), whereF);
      } else if (state.level === 'exposure') {
        detail.append(field('Exposure note (printed in brackets)', note, { hint: 'Prints as "Exposure: ' + name + ' (note)"' }), whereF);
      } else detail.append(h('p', { class: 'muted small' }, 'Never printed.'));
    };
    renderDetail();
    const saveChoice = choiceGroup({ label: 'Save to master profile?', options: [{ value: 'yes', label: 'Yes, save to profile' }, { value: 'no', label: 'Only for this resume' }], value: state.saveToProfile === true ? 'yes' : state.saveToProfile === false ? 'no' : null, onChange: (v) => { state.saveToProfile = v === 'yes' ? true : v === 'no' ? false : null; } });
    const saveF = h('div', { class: 'field' }, h('span', { class: 'label' }, found?.where === 'profile' ? 'Update your master profile, or this resume only?' : 'Save this to your master profile?'), saveChoice, h('span', { class: 'error', hidden: true }, 'Pick one.'));
    box.append(h('div', { class: 'field' }, h('span', { class: 'label' }, 'Level for ' + name), choiceGroup({ label: 'Level', options: LEVELS.filter((l) => l.value !== 'have_ai'), value: state.level, allowNone: false, onChange: (v) => { state.level = v; renderDetail(); } })),
      detail, saveF,
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          if (state.level === 'have' && !state.whereUsed.trim()) { whereF.setError('Required for "Have this": one line on where you used it.'); where.focus(); return; }
          if (state.saveToProfile == null) { saveF.querySelector('.error').hidden = false; return; }
          const level = state.level === 'have' && state.aiAssisted ? 'have_ai' : state.level;
          this.recordConfirmation(q, name, { level, aiAssisted: state.aiAssisted, whereUsed: state.whereUsed.trim(), exposureNote: state.exposureNote.trim(), saveToProfile: state.saveToProfile }, found);
          toast(state.saveToProfile ? 'Saved to your profile' : 'Kept for this resume only');
          done();
        } }, 'Confirm'),
        h('button', { type: 'button', class: 'btn', onclick: done }, 'Cancel')));
    return box;
  }

  /** Writes the confirmation to the profile or the session overlay. */
  recordConfirmation(q, name, { level, aiAssisted, whereUsed, exposureNote, saveToProfile }, found) {
    const s = this.s; const profile = this.profile;
    const cat = catalogLookup(name);
    let skillId;
    if (saveToProfile) {
      let sk = found?.where === 'profile' ? found.skill : null;
      if (!sk) { sk = { id: newId(), name: cat ? cat.name : name, category: cat ? cat.category : 'custom', level: null, whereUsed: '', exposureNote: '' }; profile.skills.push(sk); }
      sk.level = level; sk.whereUsed = whereUsed; sk.exposureNote = exposureNote;
      saveProfile(profile);
      s.overlay.skills = s.overlay.skills.filter((x) => x.name.toLowerCase() !== sk.name.toLowerCase());
      skillId = sk.id;
    } else {
      let sk = s.overlay.skills.find((x) => x.name.toLowerCase() === (cat ? cat.name : name).toLowerCase());
      if (!sk) { sk = { id: newId(), name: cat ? cat.name : name, category: cat ? cat.category : 'custom', level: null, whereUsed: '', exposureNote: '' }; s.overlay.skills.push(sk); }
      sk.level = level; sk.whereUsed = whereUsed; sk.exposureNote = exposureNote;
      skillId = sk.id;
    }
    s.confirmations = s.confirmations.filter((c) => c.reqId !== q.id);
    s.confirmations.push({ reqId: q.id, skillId, level, whereUsed, aiAssisted, saveToProfile: Boolean(saveToProfile) });
    this.touch();
  }

  // ---------- Step 4: content selection ----------
  step4(body, nav) {
    const s = this.s; const profile = this.profile; const sel = s.selection;
    const scores = recommend(profile, s);
    const main = h('div', { class: 'stack' });
    const hasEntries = (profile.entries || []).length > 0;
    if (!hasEntries) main.append(h('div', { class: 'card notice' }, h('p', null, 'No experience or projects yet, so that section is omitted. A genuine course project or an extracurricular can be included instead. ', h('a', { href: '#/profile' }, 'Add one in Profile'), '.')));
    if (isProfileSparse(profile)) main.append(h('div', { class: 'card notice' }, h('p', null, 'Your profile is short. A half-page resume is fine. Fields that could genuinely add detail: projects (a course project counts), extracurriculars, achievements.')));

    const group = (title, items, ids, key, { max = Infinity, label = (x) => x.name, sub = (x) => x.detail } = {}) => {
      const card = h('div', { class: 'card' }, h('h2', null, title, ' ', h('span', { class: 'muted small' }, max < Infinity ? `(up to ${max})` : '')));
      if (!items.length) { card.append(h('p', { class: 'muted small' }, 'Nothing in your profile yet.')); return card; }
      const ordered = orderByScore(items, scores);
      for (const it of ordered) {
        const sc = scores.get(it.id) || { score: 0, reasons: [] };
        const cb = h('input', { type: 'checkbox', checked: ids.includes(it.id), onchange: () => {
          if (cb.checked) { if (ids.length >= max) { cb.checked = false; toast(`Up to ${max}. Others stay in your profile.`, { kind: 'warn' }); return; } ids.push(it.id); }
          else ids.splice(ids.indexOf(it.id), 1);
          this.touch();
        } });
        card.append(h('label', { class: 'check' }, cb, h('span', null, h('strong', null, label(it) || '(untitled)'), sub(it) ? h('span', { class: 'muted' }, ' - ' + sub(it)) : null,
          sc.score > 0 ? h('span', { class: 'badge rec', style: { marginLeft: '.4rem' } }, 'Recommended') : null,
          sc.reasons.length ? h('span', { class: 'small muted', style: { display: 'block' } }, sc.reasons.join('; ')) : null)));
      }
      return card;
    };
    main.append(group('Experience and projects', profile.entries || [], sel.entryIds, 'entryIds', { label: (e) => e.title, sub: (e) => [e.kind === 'project' ? 'Project' : 'Experience', e.organization, formatDateRange(e.start, e.end)].filter(Boolean).join(', ') }));
    main.append(group('Achievements', profile.achievements || [], sel.achievementIds, 'achievementIds'));
    main.append(group('Extracurriculars', profile.extracurriculars || [], sel.extracurricularIds, 'extracurricularIds'));
    main.append(group('Hobbies', profile.hobbies || [], sel.hobbyIds, 'hobbyIds', { max: 4 }));

    const aboutTa = h('textarea', { rows: '3', value: sel.aboutMeText || profile.aboutMe || '' });
    const aboutCounter = charCounter(aboutTa, 300);
    aboutTa.addEventListener('input', () => { sel.aboutMeText = aboutTa.value; this.touch(); });
    main.append(h('div', { class: 'card' }, h('h2', null, 'About Me'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: Boolean(sel.includeAboutMe), onchange: (e) => { sel.includeAboutMe = e.target.checked; if (sel.includeAboutMe && !sel.aboutMeText) sel.aboutMeText = profile.aboutMe || ''; aboutTa.value = sel.aboutMeText; this.touch(); } }), h('span', null, 'Include About Me on this resume')),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'about-text' }, 'Text for this resume'), (aboutTa.id = 'about-text', aboutTa), aboutCounter, h('span', { class: 'hint' }, 'Starts from your profile text. Mention only skills you marked "Have this".'))));

    const recommendAll = () => {
      const pick = (items, ids, max) => { const top = orderByScore(items, scores).filter((i) => (scores.get(i.id)?.score || 0) > 0).slice(0, max); ids.length = 0; ids.push(...top.map((i) => i.id)); };
      pick(profile.entries || [], sel.entryIds, 4); pick(profile.achievements || [], sel.achievementIds, 3); pick(profile.extracurriculars || [], sel.extracurricularIds, 3); pick(profile.hobbies || [], sel.hobbyIds, 2);
      if (!sel.entryIds.length && (profile.entries || []).length) sel.entryIds.push(...(profile.entries || []).slice(0, 3).map((e) => e.id));
      this.touch(); this.render();
    };
    body.append(h('div', { class: 'layout with-side' }, main, h('div', { class: 'stack' },
      tipsCard(['Recommended items match words in the posting; the reason is shown under each. Nothing is added unless you tick it.', 'Pick the 2-4 strongest entries. White space under short content is fine.', 'Hobbies: up to 4 on the resume, 2 recommended.']),
      h('button', { type: 'button', class: 'btn', onclick: recommendAll }, 'Use the recommended selection'))));
    this.navButtons(nav, { next: 'Next: preview', onNext: () => this.go(5) });
  }

  // ---------- Build + fit ----------
  build() {
    if (this.built) return this.built;
    const s = this.s; const profile = this.profile;
    const pageSize = profile.settings?.pageSize || 'A4';
    const out = { model: null, trims: [], overflow: false, integrity: { ok: false, violations: [] }, summary: null, error: null, pageSize };
    try {
      let model = buildResume(profile, s);
      if (!model || typeof model !== 'object') throw new Error('buildResume returned nothing');
      model.pageSize = model.pageSize || pageSize;
      const fit = fitToPage(model, s.template.id, pageSize);
      out.model = fit.model; out.trims = fit.trims; out.overflow = fit.overflow;
      try { out.integrity = checkIntegrity(out.model, profile, s) || { ok: true, violations: [] }; } catch (e) { console.error(e); out.integrity = { ok: false, violations: [{ code: 'NO_SOURCE', message: 'Integrity check failed to run: ' + e.message, lineId: null }] }; }
      try { out.summary = buildMatchSummary(profile, s, out.model); } catch (e) { console.error(e); out.summary = null; }
    } catch (e) {
      console.error(e); out.error = e;
    }
    this.built = out;
    return out;
  }

  trimsSignature(trims) { return JSON.stringify((trims || []).map((t) => [t.step, t.what])); }
  trimsAcknowledged(b) { return !b.trims.length || this.s.ui.trimsAck === this.trimsSignature(b.trims); }
  severityOf(v) { return v.severity || (v.code === 'MISSING_VERB' ? 'warn' : 'block'); }
  blockingViolations(b) { return (b.integrity?.violations || []).filter((v) => this.severityOf(v) === 'block'); }

  // ---------- Step 5: preview ----------
  step5(body, nav) {
    const s = this.s; const profile = this.profile;
    const b = this.build();
    if (b.error) {
      body.append(h('div', { class: 'card danger' }, h('h2', null, 'Could not build the preview'), h('p', null, String(b.error.message || b.error)), h('p', { class: 'small muted' }, 'Check that your profile has a name and at least one selected item, then try again.')));
      this.navButtons(nav, { next: null });
      return;
    }
    const left = h('div', { class: 'stack' });
    const right = h('div', { class: 'stack' });

    // Preview
    const previewWrap = h('div', { class: 'preview-wrap' });
    const page = renderResume(b.model, s.template.id, b.pageSize);
    const scaler = h('div', { class: 'preview-scale preview-page' }, page);
    previewWrap.append(scaler);
    const fitScale = () => { const w = page.offsetWidth || 794; const sc = Math.min(1, (previewWrap.clientWidth - 16) / w); scaler.style.transform = `scale(${sc})`; scaler.style.width = `${w}px`; scaler.style.height = `${page.offsetHeight * sc}px`; };
    requestAnimationFrame(fitScale); this.listen(window, 'resize', fitScale);
    this.wirePreview(page);
    left.append(h('div', { class: 'card' }, h('h2', null, 'Preview'),
      h('p', { class: 'muted small' }, 'Tap any line to see where it comes from. Bullets can be edited in place; About Me and skills change through Profile or Content.'),
      b.overflow ? h('div', { class: 'card warn' }, 'Still more than one page after all allowed trims. Remove an item in Content (step 4) or shorten bullets.') : null,
      (b.model.warnings || []).length ? h('ul', { class: 'small' }, b.model.warnings.map((w) => h('li', null, w))) : null,
      previewWrap));

    // Trims
    const trims = b.model.trims?.length ? b.model.trims : b.trims;
    const trimCard = h('div', { class: 'card' }, h('h2', null, 'Changes to fit one page'));
    if (!trims.length) trimCard.append(h('p', { class: 'muted' }, 'No trims needed. Everything you selected fits.'));
    else {
      trimCard.append(h('ul', null, trims.map((t) => h('li', null, h('strong', null, t.what), t.reason ? ` - ${t.reason}` : ''))));
      trimCard.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: this.trimsAcknowledged(b), onchange: (e) => { s.ui.trimsAck = e.target.checked ? this.trimsSignature(trims) : null; this.save(); } }), h('span', null, 'I have seen these changes')));
    }
    left.append(trimCard);

    // Links
    const links = Object.entries(profile.links || {}).filter(([, v]) => v);
    if (links.length) {
      const lc = h('div', { class: 'card' }, h('h2', null, 'Links'));
      for (const [k] of links) {
        lc.append(h('div', { class: 'field' }, h('span', { class: 'label' }, { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio' }[k] || k),
          choiceGroup({ label: k, options: [{ value: 'rule', label: 'Rule decides' }, { value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }], value: s.linkOverrides[k] == null ? 'rule' : s.linkOverrides[k] ? 'show' : 'hide', allowNone: false,
            onChange: (v) => { s.linkOverrides[k] = v === 'rule' ? null : v === 'show'; this.touch(); this.render(); } })));
      }
      left.append(lc);
    }

    left.append(this.templatePicker());

    // Match summary
    right.append(this.matchSummaryCard(b));
    right.append(this.integrityCard(b));
    right.append(this.numberCard(b));

    body.append(h('div', { class: 'layout with-side' }, left, right));
    const blocked = this.blockingViolations(b).length > 0;
    this.navButtons(nav, { next: blocked ? 'Fix issues to continue' : 'Next: approve', nextDisabled: blocked, onNext: () => this.go(6) });
  }

  wirePreview(page) {
    const s = this.s;
    let pop = null;
    const closePop = () => { if (pop) { pop.remove(); pop = null; } page.querySelectorAll('.selected').forEach((x) => x.classList.remove('selected')); };
    page.addEventListener('click', (e) => {
      const el = e.target.closest('[data-line-id]');
      if (!el || el.isContentEditable) return;
      e.preventDefault();
      closePop();
      el.classList.add('selected');
      pop = this.sourcePopover(el, () => closePop());
      document.body.append(pop);
      const r = el.getBoundingClientRect();
      pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
      pop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8)}px`;
    });
    this.listen(document, 'click', (e) => { if (pop && !pop.contains(e.target) && !page.contains(e.target)) closePop(); });
    this.cleanups.push(closePop);
    page.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
    page.querySelectorAll('[data-line-id]').forEach((el) => { if (!el.hasAttribute('tabindex')) el.tabIndex = 0; el.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !el.isContentEditable) { ev.preventDefault(); el.click(); } }); });
  }

  sourceDetails(type, id) {
    const p = this.profile; const s = this.s;
    const dl = (pairs) => h('dl', null, pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => [h('dt', null, k), h('dd', null, String(v))]));
    const entryOf = (eid) => (p.entries || []).find((e) => e.id === eid);
    switch (type) {
      case 'bullet': {
        const e = (p.entries || []).find((x) => (x.bullets || []).some((bl) => bl.id === id));
        const bl = e && e.bullets.find((x) => x.id === id);
        return { title: 'Bullet from ' + (e?.title || 'entry'), body: dl([['Entry', e?.title], ['Organization', e?.organization], ['Role', e?.role], ['Dates', e ? formatDateRange(e.start, e.end) : ''], ['Original text', bl?.text], ['Your edit', s.bulletEdits[id]]]), editable: true };
      }
      case 'entry': { const e = entryOf(id); return { title: e?.kind === 'project' ? 'Project' : 'Experience', body: dl([['Title', e?.title], ['Organization', e?.organization], ['Role', e?.role], ['Dates', e ? formatDateRange(e.start, e.end) : ''], ['Result', e?.result?.text]]) }; }
      case 'skill': { const sk = [...(p.skills || []), ...(s.overlay.skills || [])].find((x) => x.id === id); return { title: 'Skill', body: sk ? dl([['Name', sk.name], ['Level', levelLabel(sk.level)], ['Where used (private)', sk.whereUsed], ['Note', sk.exposureNote]]) : h('p', null, 'Skills group from your profile.') }; }
      case 'language': { const l = (p.languages || []).find((x) => x.id === id); return { title: 'Language', body: l ? dl([['Name', l.name], ['Level', l.level]]) : h('p', null, 'Languages from your profile.') }; }
      case 'education': { const ed = (p.education || []).find((x) => x.id === id); return { title: 'Education', body: ed ? dl([['Degree', ed.degree], ['Branch', ed.branch], ['Institution', ed.institution], ['Year', ed.yearOfStudy], ['Graduation', ed.expectedGradYear]]) : h('p', null, 'Education from your profile.') }; }
      case 'achievement': { const a = (p.achievements || []).find((x) => x.id === id); return { title: 'Achievement', body: dl([['Name', a?.name], ['Date', a?.date], ['Detail', a?.detail]]) }; }
      case 'extracurricular': { const a = (p.extracurriculars || []).find((x) => x.id === id); return { title: 'Extracurricular', body: dl([['Name', a?.name], ['Date', a?.date], ['Detail', a?.detail]]) }; }
      case 'hobby': { const a = (p.hobbies || []).find((x) => x.id === id); return { title: 'Hobby', body: dl([['Name', a?.name], ['Detail', a?.detail]]) }; }
      case 'link': return { title: 'Link', body: dl([['Type', id], ['URL', p.links?.[id]]]) };
      case 'basics': return { title: 'Basics', body: dl([['Field', id], ['Value', p.basics?.[id]]]) };
      case 'about': return { title: 'About Me', body: h('p', null, 'Your own text from Content (step 4) or Profile. Not edited in place.') };
      case 'work': return { title: 'Work preference', body: dl([['Preference', p.work?.preference], ['Hours/week', p.work?.hoursPerWeek], ['Start', p.work?.startDate]]) };
      case 'marks': return { title: 'Marks', body: dl([['CGPA', p.marks?.cgpa?.value], ['12th', p.marks?.twelfth?.value]]) };
      default: return { title: 'Source', body: dl([['Type', type], ['Id', id]]) };
    }
  }

  sourcePopover(el, close) {
    const type = el.dataset.srcType || ''; const id = el.dataset.srcId || ''; const lineId = el.dataset.lineId;
    const d = this.sourceDetails(type, id);
    const pop = h('div', { class: 'src-pop', role: 'dialog', 'aria-label': 'Line source' }, h('strong', null, d.title), h('span', { class: 'badge', style: { marginLeft: '.4rem' } }, type || 'unknown'), d.body);
    const row = h('div', { class: 'btn-row' });
    if (type === 'bullet' && id) {
      row.append(h('button', { type: 'button', class: 'btn small primary', onclick: () => { close(); this.editInline(el, id); } }, 'Edit text'));
      if (this.s.bulletEdits[id] != null) row.append(h('button', { type: 'button', class: 'btn small', onclick: () => { delete this.s.bulletEdits[id]; this.touch(); this.render(); } }, 'Restore original'));
    } else {
      row.append(h('a', { class: 'btn small', href: '#/profile' }, 'Edit in Profile'));
    }
    row.append(h('button', { type: 'button', class: 'btn small', onclick: close }, 'Close'));
    pop.append(row);
    return pop;
  }

  editInline(el, bulletId) {
    el.contentEditable = 'true';
    el.focus();
    const sel = window.getSelection(); if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
    const finish = () => {
      el.contentEditable = 'false';
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text.length > 110) toast('Over 110 characters: keep it to two lines.', { kind: 'warn' });
      this.s.bulletEdits[bulletId] = text;
      this.touch();
      this.render();
    };
    el.addEventListener('blur', finish, { once: true });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } if (e.key === 'Escape') { e.preventDefault(); el.removeEventListener('blur', finish); el.contentEditable = 'false'; this.render(); } });
  }

  templatePicker() {
    const s = this.s;
    const card = h('div', { class: 'card' }, h('h2', null, 'Template'), h('p', { class: 'muted small' }, 'No template is "ATS-friendly" or "guaranteed to pass". The text-first layout is the safer choice for online portals. ', h('a', { href: '#/rules' }, 'See the full comparison'), '.'));
    const filters = { columns: null, graphics: null, colour: null };
    const grid = h('div', { class: 'tpl-grid' });
    const renderGrid = () => {
      clear(grid);
      const list = TEMPLATES.filter((t) => (filters.columns == null || String(t.columns) === filters.columns) && (filters.graphics == null || t.graphics === filters.graphics) && (filters.colour == null || t.colour === filters.colour));
      if (!list.length) grid.append(h('p', { class: 'muted small' }, 'No template matches these filters.'));
      for (const t of list) {
        grid.append(h('button', { type: 'button', class: 'tpl-card', 'aria-pressed': s.template.id === t.id ? 'true' : 'false', onclick: () => this.chooseTemplate(t) },
          h('span', { class: 'tpl-name' }, t.label), h('span', { class: 'muted small' }, `${t.columns === 2 ? 'Two columns' : 'Single column'}, ${t.graphics === 'none' ? 'no graphics' : t.graphics}, ${t.colour}`), h('br'),
          t.recommended ? h('span', { class: 'badge rec' }, 'Recommended') : h('span', { class: 'badge care' }, 'Use with care')));
      }
    };
    const f = (key, label, opts) => h('div', { class: 'field' }, h('span', { class: 'label small' }, label), choiceGroup({ label, options: opts, onChange: (v) => { filters[key] = v; renderGrid(); } }));
    card.append(h('div', { class: 'grid-2' },
      f('columns', 'Columns', [{ value: '1', label: 'One' }, { value: '2', label: 'Two' }]),
      f('graphics', 'Graphics', [{ value: 'none', label: 'None' }, { value: 'light', label: 'Light' }, { value: 'photo', label: 'Photo' }]),
      f('colour', 'Colour', [{ value: 'neutral', label: 'Neutral' }, { value: 'accent', label: 'Accent' }])));
    renderGrid();
    card.append(grid);
    return card;
  }

  async chooseTemplate(t) {
    const s = this.s;
    if (s.template.id === t.id) return;
    const prev = s.template;
    s.template = templateSpec(t.id);
    this.touch();
    const st = loadSettings();
    if (t.trigger && !s.ui.warned[t.trigger] && !st.dontShowAgain[t.trigger]) {
      s.ui.warned[t.trigger] = true; this.save();
      const dont = h('input', { type: 'checkbox' });
      const v = await modal({ title: 'Before you use this template', body: h('div', null,
        h('p', null, 'Photos and multi-column or graphic layouts may be read incorrectly by some applicant tracking systems (ATS).'),
        h('p', null, 'Photo conventions vary: discouraged in many contexts, can introduce bias, expected in some countries and roles.'),
        h('p', null, 'For online portals a text-first resume is the safer choice. A visual version can suit design or editing applications sent directly to a person.'),
        h('label', { class: 'check' }, dont, h('span', null, "Don't show again"))),
        buttons: [{ label: 'See full comparison', value: 'compare' }, { label: 'Use text-first instead', value: 'text' }, { label: 'Continue with this template', value: 'continue', primary: true }] });
      if (dont.checked) updateSettings({ dontShowAgain: { ...st.dontShowAgain, [t.trigger]: true } });
      if (v === 'text') { s.template = templateSpec('text_first'); this.touch(); }
      if (v === 'compare') { this.render(); location.hash = '#/rules'; return; }
      if (v == null && prev) { /* dismissed: keep the chosen template (non-blocking) */ }
    }
    this.render();
  }

  matchSummaryCard(b) {
    const s = this.s; const sm = b.summary;
    const card = h('div', { class: 'card private' }, h('h2', null, 'Private match summary ', h('span', { class: 'badge private' }, 'never printed')));
    if (!sm) { card.append(h('p', { class: 'muted' }, 'Summary unavailable.')); return card; }
    const icon = { met: '✅', partial: '🟡', not_met: '❌' };
    const label = { met: 'Met', partial: 'Partly met (exposure)', not_met: 'Not met' };
    card.append(h('ul', { style: { listStyle: 'none', padding: 0 } }, (sm.requirements || []).map((r) => h('li', { class: 'status-' + r.status }, `${icon[r.status] || ''} ${label[r.status] || r.status}: `, h('span', { style: { color: 'var(--text)' } }, r.text), r.via ? h('span', { class: 'muted small' }, ` (${r.via})`) : null))));
    const txt = (x) => (typeof x === 'string' ? x : x == null ? '' : JSON.stringify(x));
    card.append(h('p', { class: 'small' }, h('strong', null, 'Work-mode fit: '), txt(sm.workModeFit) || 'not stated'));
    const ver = sm.verification;
    const statusLabel = { found: 'Company found', multiple: 'Multiple matches', could_not_confirm: 'Could not confirm', not_checked: 'Not checked' };
    if (ver && typeof ver === 'object') {
      card.append(h('p', { class: 'small' }, h('strong', null, 'Verification: '), statusLabel[ver.companyCheck] || ver.companyCheck || '', ver.companyNote ? ` - ${ver.companyNote}` : ''));
      if (ver.sourceUnverified || ver.feeWarning) card.append(h('p', { class: 'small status-partial' }, h('strong', null, ver.sourceUnverified ? 'Unverified source' : 'Fee warning', ' '), ver.sourceLabel ? `(${ver.sourceLabel}). ` : '', ver.caution || UNVERIFIED_TEXT));
    } else {
      card.append(h('p', { class: 'small' }, h('strong', null, 'Verification: '), txt(ver) || statusLabel[s.companyCheck.status] || ''));
      if (UNVERIFIED_SOURCES.includes(s.role.source)) card.append(h('p', { class: 'small status-partial' }, h('strong', null, 'Unverified source. '), UNVERIFIED_TEXT));
    }
    if ((sm.interviewPrep || []).length) card.append(h('div', null, h('strong', { class: 'small' }, 'Interview prep: lines most likely to be asked about'), h('ul', { class: 'small' }, sm.interviewPrep.map((p) => h('li', null, p)))));
    if (sm.sparse) card.append(h('p', { class: 'small muted' }, 'Sparse profile: a half-page resume is fine.'));
    card.append(h('button', { type: 'button', class: 'btn small', onclick: () => downloadText(`PRIVATE-do-not-send-${(s.role.company || 'company').replace(/\s+/g, '-')}.txt`, privateSummaryText(sm, s, this.profile)) }, 'Save private summary (.txt)'));
    return card;
  }

  integrityCard(b) {
    const s = this.s;
    const vs = b.integrity?.violations || [];
    const card = h('div', { class: 'card' }, h('h2', null, 'Integrity check'));
    if (!vs.length) { card.append(h('p', { class: 'status-met' }, '✅ Every line traces to your profile. No banned level words, no unconfirmed numbers, no ratings.')); return card; }
    for (const v of vs) {
      const sev = this.severityOf(v);
      const item = h('div', { class: 'violation ' + sev }, h('strong', null, sev === 'block' ? 'Blocks approval: ' : 'Warning: '), v.message || v.code, v.lineId ? h('button', { type: 'button', class: 'btn link small', onclick: () => { const el = document.querySelector(`.preview-page [data-line-id="${CSS.escape(String(v.lineId))}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); } } }, 'Show line') : null);
      if (v.code === 'MISSING_VERB' && v.lineId && this.isBulletLine(v.lineId)) {
        const groups = Object.keys(VERB_GROUPS).length ? VERB_GROUPS : { Verbs: VERBS_FLAT };
        const picker = h('div');
        for (const [g, verbs] of Object.entries(groups)) {
          picker.append(h('p', { class: 'muted small', style: { margin: '.4rem 0 .2rem' } }, g), h('div', { class: 'chips' }, verbs.slice(0, 14).map((verb) => h('button', { type: 'button', class: 'chip', onclick: () => this.prependVerb(v.lineId, verb) }, verb))));
        }
        item.append(h('details', null, h('summary', { class: 'small' }, 'Pick a verb'), picker));
      }
      card.append(item);
    }
    return card;
  }

  isBulletLine(lineId) {
    return (this.profile.entries || []).some((e) => (e.bullets || []).some((bl) => bl.id === lineId));
  }
  currentBulletText(lineId) {
    if (this.s.bulletEdits[lineId] != null) return this.s.bulletEdits[lineId];
    for (const e of this.profile.entries || []) for (const bl of e.bullets || []) if (bl.id === lineId) return bl.text;
    return '';
  }
  prependVerb(lineId, verb) {
    const t = this.currentBulletText(lineId).trim();
    this.s.bulletEdits[lineId] = `${verb} ${t.charAt(0).toLowerCase()}${t.slice(1)}`.trim();
    this.touch(); this.render();
  }

  numberCard(b) {
    const s = this.s;
    const vs = (b.integrity?.violations || []).filter((v) => v.code === 'UNCONFIRMED_NUMBER' && v.lineId);
    const existing = Object.entries(s.numberConfirmations || {});
    if (!vs.length && !existing.length) return h('span');
    const card = h('div', { class: 'card private' }, h('h2', null, 'Numbers'), h('p', { class: 'muted small' }, 'A number prints only with evidence or your explicit confirmation plus a private source note.'));
    for (const v of vs) {
      const note = h('input', { type: 'text', placeholder: 'How you got this number (private)' });
      const cb = h('input', { type: 'checkbox' });
      card.append(h('div', { class: 'item' }, h('p', { class: 'small' }, this.currentBulletText(v.lineId) || v.message),
        h('label', { class: 'check' }, cb, h('span', null, 'I can explain how I got this number')),
        field('Source note (private)', note),
        h('button', { type: 'button', class: 'btn small primary', onclick: () => {
          if (!cb.checked || !note.value.trim()) { toast('Tick the box and add a source note.', { kind: 'warn' }); return; }
          s.numberConfirmations[v.lineId] = { confirmed: true, sourceNote: note.value.trim() }; this.touch(); this.render();
        } }, 'Confirm number')));
    }
    for (const [id, c] of existing) {
      card.append(h('div', { class: 'row between small' }, h('span', null, '✅ Confirmed: ', this.currentBulletText(id) || id, h('span', { class: 'muted' }, ` (${c.sourceNote})`)),
        h('button', { type: 'button', class: 'btn small', onclick: () => { delete s.numberConfirmations[id]; this.touch(); this.render(); } }, 'Undo')));
    }
    return card;
  }

  // ---------- Step 6: approval ----------
  step6(body, nav) {
    const s = this.s; const profile = this.profile;
    const b = this.build();
    if (b.error) { body.append(h('div', { class: 'card danger' }, h('p', null, 'Could not build the resume: ' + b.error.message))); this.navButtons(nav, {}); return; }
    let defaultName = 'resume.pdf';
    try { defaultName = resumeFileName(profile, s); } catch (e) { /* keep default */ }
    if (!s.ui.fileName) s.ui.fileName = defaultName;
    const fileInput = h('input', { type: 'text', value: s.ui.fileName });
    fileInput.addEventListener('input', () => { s.ui.fileName = fileInput.value; this.save(); });

    const blocking = this.blockingViolations(b);
    const trimsOk = this.trimsAcknowledged(b);
    const checks = h('ul', null,
      h('li', { class: blocking.length ? 'status-not_met' : 'status-met' }, blocking.length ? `${blocking.length} integrity issue(s) block approval (see step 5)` : 'Integrity check passed'),
      h('li', { class: trimsOk ? 'status-met' : 'status-not_met' }, trimsOk ? 'Changes to fit one page acknowledged' : 'Acknowledge the changes to fit one page in step 5'),
      h('li', { class: b.overflow ? 'status-not_met' : 'status-met' }, b.overflow ? 'Still over one page: remove content' : 'Fits one page'));
    const canApprove = !blocking.length && trimsOk && !b.overflow;

    const card = h('div', { class: 'card' }, h('h2', null, 'Step 6: Approve'),
      h('p', null, 'No PDF is rendered or saved before this point. Approval locks a snapshot; any later edit or template change needs a new approval.'),
      field('File name', fileInput, { hint: 'Default: Firstname-Lastname-Company-Role.pdf' }), checks);
    if (s.approval.approved) {
      card.append(h('div', { class: 'card ok' }, h('p', null, h('strong', null, 'Approved '), formatDate(s.approval.approvedAt), h('br'), h('span', { class: 'small muted' }, 'Snapshot ' + String(s.approval.snapshotHash).slice(0, 12))),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => printModel(b.model, s.template.id, b.pageSize, s.ui.fileName) }, 'Print / save PDF again'), h('a', { class: 'btn', href: '#/saved' }, 'Saved versions'))));
    } else {
      card.append(h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn primary', disabled: !canApprove, onclick: async () => {
          const name = (s.ui.fileName || defaultName).trim().replace(/\.pdf$/i, '') + '.pdf';
          s.ui.fileName = name;
          const model = JSON.parse(JSON.stringify(b.model));
          let hash = null;
          try { hash = await snapshotHash(model, s.template); } catch (e) { console.error(e); toast('Could not compute the snapshot hash.', { kind: 'danger' }); return; }
          s.approval = { approved: true, snapshotHash: hash, approvedAt: new Date().toISOString() };
          s.ui.reapprove = false;
          this.save();
          addSnapshot({ id: newId(), company: s.role.company, role: s.role.title, date: s.approval.approvedAt, template: s.template.id, fileName: name, model, session: JSON.parse(JSON.stringify(s)) });
          toast('Approved and saved. Choose "Save as PDF" in the print dialog.', { kind: 'ok' });
          printModel(model, s.template.id, b.pageSize, name);
          this.render();
        } }, 'Approve and generate PDF')));
      if (!canApprove) card.append(h('p', { class: 'small muted' }, 'Fix the items above first.'));
    }
    if (b.summary) card.append(h('button', { type: 'button', class: 'btn small', onclick: () => downloadText(`PRIVATE-do-not-send-${(s.role.company || 'company').replace(/\s+/g, '-')}.txt`, privateSummaryText(b.summary, s, profile)) }, 'Save private summary (.txt)'));
    body.append(h('div', { class: 'layout with-side' }, card, tipsCard(['In the print dialog choose "Save as PDF" and keep the suggested file name.', 'The PDF has a selectable text layer and standard fonts; no text is drawn as an image.', 'Keep the private summary for yourself; it is marked "Private, do not send".'])));
    this.navButtons(nav, { next: null });
  }
}

/** Real measurement: render into the hidden host and trim until it fits one page. */
export function fitToPage(model, templateId, pageSize) {
  const host = document.getElementById('fit-host');
  let m = model; const trims = []; let overflow = false;
  if (!host) return { model: m, trims, overflow };
  for (let i = 0; i < 40; i++) {
    clear(host);
    const el = renderResume(m, templateId, pageSize);
    el.classList.add('measure');
    host.append(el);
    const over = el.scrollHeight > el.clientHeight + 1;
    if (!over) { overflow = false; break; }
    overflow = true;
    let r;
    try { r = applyNextTrim(m); } catch (e) { console.error(e); break; }
    if (!r || !r.trim) break;
    m = r.model || m;
    trims.push(r.trim);
  }
  clear(host);
  return { model: m, trims, overflow };
}
