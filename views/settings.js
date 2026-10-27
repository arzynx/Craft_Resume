// Settings: page size, AI assist, sync opt-in, export/import, delete everything, privacy.
import { h, clear, field, choiceGroup, toast, modal, confirmDialog, downloadText } from '../ui.js';
import { loadProfile, saveProfile, replaceProfile, exportProfileJson, importProfileJson, deleteEverything,
  loadSettings, updateSettings, loadSnapshots, saveSnapshots } from '../store.js';
import { hasBackend } from '../config.js';

export const AI_DISCLOSURE = 'AI features send your job description and selected resume text to Anthropic (Claude). Use rules-only mode to keep everything on your device.';

export function renderSettings(view) {
  clear(view);
  const profile = loadProfile();
  const settings = loadSettings();
  profile.settings = profile.settings || { pageSize: 'A4', aiEnabled: false, syncEnabled: false };

  view.append(h('div', { class: 'page-title' }, h('h1', null, 'Settings')));

  // Page size
  view.append(h('div', { class: 'card' }, h('h2', null, 'Page size'),
    choiceGroup({ label: 'Page size', options: [{ value: 'A4', label: 'A4 (default)' }, { value: 'Letter', label: 'Letter (US)' }],
      value: profile.settings.pageSize || 'A4', allowNone: false,
      onChange: (v) => { profile.settings.pageSize = v || 'A4'; saveProfile(profile); toast('Page size: ' + profile.settings.pageSize); } })));

  // AI assist
  const aiCard = h('div', { class: 'card' }, h('h2', null, 'AI assist (optional)'));
  const aiExplain = h('p', { class: 'muted' },
    'Rules-only mode is the complete product: keyword matching against your profile, fixed role-family ordering and a fixed verb list, all on your device. ',
    'AI can only suggest: it may extract requirements, suggest a role family and order, and reword your own bullets. It can never add facts, skills, numbers, tools or dates, change a level, or remove an "AI-assisted" or "reading level" label. Deterministic checks run after every AI output.');
  aiCard.append(aiExplain);
  if (!hasBackend()) {
    aiCard.append(h('p', null, h('span', { class: 'badge' }, 'Rules-only'), ' This build has no backend configured, so AI assist and the company check are unavailable. Everything stays on this device.'));
  }
  const aiToggle = h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: Boolean(profile.settings.aiEnabled), disabled: !hasBackend(), onchange: async (e) => {
      if (e.target.checked && !settings.aiDisclosureAccepted) {
        const v = await modal({ title: 'Before you turn on AI assist', body: h('div', null, h('p', null, AI_DISCLOSURE),
          h('p', { class: 'muted small' }, 'Contact details and your photo are never sent. Only the job description and the resume text you selected are shared.')),
          buttons: [{ label: 'Keep rules-only', value: null }, { label: 'Turn on AI assist', value: 'ok', primary: true }] });
        if (v !== 'ok') { e.target.checked = false; return; }
        updateSettings({ aiDisclosureAccepted: true });
      }
      profile.settings.aiEnabled = e.target.checked; saveProfile(profile);
      toast(profile.settings.aiEnabled ? 'AI assist on' : 'Rules-only mode');
    } }),
    h('span', null, 'Use AI assist for extraction, ordering and rewording suggestions'));
  aiCard.append(aiToggle, h('p', { class: 'small muted' }, AI_DISCLOSURE));
  view.append(aiCard);

  // Sync (only when CONFIG is filled)
  if (hasBackend()) view.append(syncCard(profile, settings));

  // Export / import
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file' });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; if (!f) return;
    const text = await f.text();
    const r = importProfileJson(text);
    if (!r.ok || !r.profile) { await modal({ title: 'Could not import', body: h('ul', null, (r.errors.length ? r.errors : ['Unknown error']).map((e) => h('li', null, e))) }); file.value = ''; return; }
    const ok = await confirmDialog('Replace your profile?', 'The imported file will replace the profile stored on this device. Export first if you want a backup.', { okLabel: 'Replace' });
    if (ok) { replaceProfile(r.profile); toast('Profile imported', { kind: 'ok' }); renderSettings(view); }
    file.value = '';
  });
  view.append(h('div', { class: 'card' }, h('h2', null, 'Your data'),
    h('p', { class: 'muted' }, 'View, edit, export and import your profile JSON any time.'),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const name = (profile.basics?.fullName || 'profile').trim().replace(/\s+/g, '-') || 'profile';
        downloadText(`resumme-profile-${name}.json`, exportProfileJson(profile), 'application/json'); toast('Exported');
      } }, 'Export profile JSON'),
      h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, 'Import profile JSON'),
      file)));

  // Delete everything
  view.append(h('div', { class: 'card danger' }, h('h2', null, 'Delete everything'),
    h('p', null, 'Removes your profile, photo, in-progress tailoring and saved versions from this device. Downloaded PDF copies remain under your control.'),
    h('button', { type: 'button', class: 'btn danger', onclick: async () => {
      const ok = await confirmDialog('Delete everything on this device?', 'This cannot be undone. Export your profile first if you may want it back.', { okLabel: 'Delete everything', danger: true });
      if (ok) { deleteEverything(); toast('Everything deleted'); location.hash = '#/profile'; }
    } }, 'Delete everything')));

  // Privacy (SPEC 17)
  view.append(h('div', { class: 'card' }, h('h2', null, 'Privacy'),
    h('ul', null,
      h('li', null, 'Your master profile, photo and saved versions are stored on this device by default. Account sync is optional and opt-in.'),
      h('li', null, 'AI and verification calls, when enabled, send only the job description and selected resume text. Contact details and your photo are never sent.'),
      h('li', null, 'You can view, edit, export and import your profile JSON at any time, and delete your profile, photo and app-stored versions whenever you like.'),
      h('li', null, 'Pasted job descriptions are kept only for the session unless you save the tailored version.'),
      h('li', null, 'Resum.me never shares anything with employers, job boards, advertisers or third parties, and runs no analytics on profile content.'))));
}

function syncCard(profile, settings) {
  const card = h('div', { class: 'card' }, h('h2', null, 'Account sync (optional)'));
  card.append(h('p', { class: 'muted' }, 'Off by default. When on, your profile (without the photo) and saved versions are copied to your account so you can use them on another device.'));
  const status = h('p', { class: 'small', 'aria-live': 'polite' });
  const body = h('div');
  const toggle = h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: Boolean(profile.settings.syncEnabled), onchange: (e) => {
      profile.settings.syncEnabled = e.target.checked; saveProfile(profile); refresh();
    } }),
    h('span', null, 'Enable account sync'));
  card.append(toggle, status, body);

  async function refresh() {
    while (body.firstChild) body.removeChild(body.firstChild);
    status.textContent = '';
    if (!profile.settings.syncEnabled) return;
    let sync;
    try { sync = await import('../sync.js'); } catch (e) { status.textContent = 'Sync module could not load.'; return; }
    const user = await sync.getUser();
    if (!user) {
      const email = h('input', { type: 'email', placeholder: 'you@example.com', value: settings.syncEmail || '', autocomplete: 'email' });
      body.append(field('Email for the magic link', email),
        h('button', { type: 'button', class: 'btn primary', onclick: async () => {
          if (!email.value.trim()) { toast('Enter your email', { kind: 'warn' }); return; }
          updateSettings({ syncEmail: email.value.trim() });
          const r = await sync.signInWithMagicLink(email.value.trim());
          status.textContent = r.message; toast(r.message, { kind: r.ok ? 'ok' : 'danger' });
        } }, 'Send sign-in link'));
      return;
    }
    status.textContent = `Signed in as ${user.email}.`;
    body.append(h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const r1 = await sync.pushProfile(profile);
        const r2 = await sync.pushSnapshots(loadSnapshots());
        toast(r1.ok && r2.ok ? 'Uploaded to your account' : (r1.message || r2.message || 'Upload failed'), { kind: r1.ok && r2.ok ? 'ok' : 'danger' });
      } }, 'Upload this device to account'),
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        const remote = await sync.pullProfile();
        if (!remote) { toast('Nothing stored in your account yet.'); return; }
        const ok = await confirmDialog('Replace local profile with the account copy?', 'Your photo stays on this device.', { okLabel: 'Replace' });
        if (!ok) return;
        const photo = profile.basics?.photoDataUrl;
        const merged = { ...remote, settings: { ...(remote.settings || {}), syncEnabled: true } };
        if (photo) { merged.basics = merged.basics || {}; merged.basics.photoDataUrl = photo; }
        replaceProfile(merged);
        const snaps = await sync.pullSnapshots();
        if (snaps.length) {
          const local = loadSnapshots(); const ids = new Set(local.map((s) => s.id));
          saveSnapshots([...local, ...snaps.filter((s) => !ids.has(s.id))]);
        }
        toast('Downloaded from your account', { kind: 'ok' });
      } }, 'Download account copy to this device'),
      h('button', { type: 'button', class: 'btn', onclick: async () => { await sync.signOut(); toast('Signed out'); refresh(); } }, 'Sign out')));
  }
  refresh();
  return card;
}
