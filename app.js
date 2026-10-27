// Resum.me - app shell: hash router, onboarding, sparse-profile notice.
import { h, clear } from './ui.js';
import { loadProfile, loadSettings, updateSettings, isProfileEmpty, isProfileSparse, onChange } from './store.js';
import { renderProfile } from './views/profile.js';
import { renderTailor } from './views/tailor.js';
import { renderSaved } from './views/saved.js';
import { renderRules } from './views/rules.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  profile: renderProfile,
  tailor: renderTailor,
  saved: renderSaved,
  rules: renderRules,
  settings: renderSettings
};

function currentRoute() {
  const m = /^#\/([a-z]+)/.exec(location.hash || '');
  return m && ROUTES[m[1]] ? m[1] : 'profile';
}

function onboardingCard() {
  const profile = loadProfile();
  const st = loadSettings();
  if (st.onboardingDismissed || !isProfileEmpty(profile)) return null;
  return h('div', { class: 'card onboard' },
    h('h2', null, 'Welcome to Resum.me'),
    h('p', null, 'One master profile with true information, then a one-page resume tailored to each role. Every printed line traces back to something you confirmed; nothing is invented.'),
    h('p', null, h('strong', null, 'Start with your Profile. '), 'It takes about 20 minutes: basics, education, skills with a private note on where you used each one, and a project or two.'),
    h('p', { class: 'small muted' }, 'Everything stays on this device unless you turn on sync in Settings.'),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn primary', href: '#/profile' }, 'Build my profile'),
      h('button', { type: 'button', class: 'btn', onclick: () => { updateSettings({ onboardingDismissed: true }); render(); } }, 'Dismiss')));
}

function sparseNotice(route) {
  if (route !== 'tailor') return null;
  const profile = loadProfile();
  if (isProfileEmpty(profile) || !isProfileSparse(profile)) return null;
  return h('div', { class: 'card notice' }, h('p', null, h('strong', null, 'Short profile, and that is fine. '),
    'A half-page resume is acceptable. If you have a genuine course project, club task or volunteering stint, ', h('a', { href: '#/profile#entries' }, 'adding it'), ' gives the tailoring step more to choose from.'));
}

function setActiveTab(route) {
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function render() {
  const route = currentRoute();
  const view = document.getElementById('view');
  setActiveTab(route);
  clear(view);
  const onboard = onboardingCard();
  if (onboard && route !== 'settings') view.append(onboard);
  const sparse = sparseNotice(route);
  if (sparse) view.append(sparse);
  const holder = h('div');
  view.append(holder);
  try {
    ROUTES[route](holder);
  } catch (e) {
    console.error(e);
    holder.append(h('div', { class: 'card danger' }, h('h2', null, 'Something went wrong'), h('p', null, String(e && e.message || e)), h('p', { class: 'small muted' }, 'Your data is safe in this browser. Reload the page, or export your profile from Settings.')));
  }
  if (!location.hash) history.replaceState(null, '', '#/' + route);
}

window.addEventListener('hashchange', render);
onChange((key) => { if (key === '*') render(); });
render();

// Smoke-test hook (dev only): ?smoke=1 renders every route in turn and reports to #smoke-result.
// ?smoke=full additionally seeds a sample profile + a step-5 session, only when the profile is empty.
const smokeMode = new URLSearchParams(location.search).get('smoke');
if (smokeMode) {
  (async () => {
    const out = [];
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    if (smokeMode === 'full' && isProfileEmpty(loadProfile())) {
      try {
        const { seedSample } = await import('./smoke-seed.js');
        const info = await seedSample();
        out.push('seed: ' + info);
      } catch (e) { out.push('seed: ERROR ' + (e && e.message)); }
    }
    for (const r of Object.keys(ROUTES)) {
      try { location.hash = '#/' + r; await wait(50); render(); await wait(50); out.push(`${r}: ok (${document.getElementById('view').querySelectorAll('*').length} nodes)`); }
      catch (e) { out.push(`${r}: ERROR ${e && e.message}`); }
    }
    if (smokeMode === 'full') {
      try {
        location.hash = '#/tailor'; await wait(50); render(); await wait(100);
        const v = document.getElementById('view');
        const page = v.querySelector('.preview-page .resume');
        out.push('preview: ' + (page ? `rendered template=${page.dataset.template} page=${page.dataset.page} lines=${page.querySelectorAll('[data-line-id]').length}` : 'MISSING'));
        const trims = [...v.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent.startsWith('Changes to fit'));
        out.push('trims: ' + (trims ? trims.textContent.replace(/\s+/g, ' ').slice(0, 200) : 'MISSING'));
        const integ = [...v.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent.startsWith('Integrity'));
        out.push('integrity: ' + (integ ? integ.textContent.replace(/\s+/g, ' ').slice(0, 300) : 'MISSING'));
        const summary = [...v.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent.startsWith('Private match'));
        out.push('summary: ' + (summary ? summary.textContent.replace(/\s+/g, ' ').slice(0, 300) : 'MISSING'));
        const next = [...v.querySelectorAll('.wizard-nav .btn')].pop();
        out.push('next: ' + (next ? `${next.textContent} disabled=${next.disabled}` : 'MISSING'));
      } catch (e) { out.push('step5: ERROR ' + (e && e.message)); }
    }
    const pre = h('pre', { id: 'smoke-result' }, out.join('\n'));
    document.body.append(pre);
  })();
}
