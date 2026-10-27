// Master profile editor. Autosaves on input (debounced) to hr.profile.
import { h, clear, field, bindInput, choiceGroup, toast, modal, confirmDialog, helperPopover, tipsCard, charCounter } from '../ui.js';
import { loadProfile, saveProfile, autosaveProfile, loadSettings, updateSettings, isProfileSparse } from '../store.js';
import { newId } from '../core/schema.js';
import { LEVELS, LANGUAGE_LEVELS, WORK_PREFS, DISPLAY_OPTIONS, SKILL_CATEGORIES, SKILL_CATALOG, FILLER_HOBBIES, HOBBY_EXAMPLES, helperFor, labelOf } from '../catalog.js';
import { formatDateRange } from '../render.js';

const BULLET_MAX = 110;
const ABOUT_MAX = 300;

const CATALOG_FALLBACK = {
  core: ['Teamwork and collaboration', 'Time and event management', 'People coordination', 'Communication', 'Leadership', 'Creativity'],
  tool: ['DaVinci Resolve', 'Figma', 'Canva', 'Adobe Premiere Pro', 'ChatGPT', 'Notion', 'Google Workspace', 'MS Excel'],
  programming: ['HTML/CSS', 'JavaScript', 'C/C++', 'Python', 'Java', 'SQL']
};

function ensure(profile) {
  profile.basics = profile.basics || {};
  for (const k of ['education', 'skills', 'languages', 'entries', 'achievements', 'extracurriculars', 'hobbies']) if (!Array.isArray(profile[k])) profile[k] = [];
  profile.marks = profile.marks || {};
  profile.marks.cgpa = profile.marks.cgpa || { value: null, display: 'relevant' };
  profile.marks.twelfth = profile.marks.twelfth || { value: null, display: 'relevant' };
  profile.links = profile.links || { linkedin: '', github: '', portfolio: '' };
  profile.work = profile.work || { preference: 'none', hoursPerWeek: '', startDate: '' };
  if (typeof profile.aboutMe !== 'string') profile.aboutMe = '';
  if (!profile.languages.length) {
    profile.languages.push({ id: newId(), name: 'English', level: null }, { id: newId(), name: 'Hindi', level: null });
  }
  return profile;
}

export function renderProfile(view) {
  clear(view);
  const profile = ensure(loadProfile());
  const save = () => autosaveProfile();

  view.append(h('div', { class: 'page-title' }, h('h1', null, 'Master profile'),
    h('span', { class: 'muted small' }, 'True information, written once. Private notes are never printed. Saves automatically.')));

  const sections = [
    ['basics', 'Basics'], ['education', 'Education'], ['skills', 'Skills'], ['languages', 'Languages'], ['links', 'Links'],
    ['entries', 'Experience & projects'], ['achievements', 'Achievements'], ['extracurriculars', 'Extracurriculars'],
    ['hobbies', 'Hobbies'], ['work', 'Work preference'], ['about', 'About Me']
  ];
  view.append(h('nav', { class: 'subnav', 'aria-label': 'Profile sections' }, sections.map(([id, label]) => h('a', { href: '#/profile#' + id, onclick: (e) => { e.preventDefault(); document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, label))));

  if (isProfileSparse(profile)) {
    view.append(h('div', { class: 'card notice' }, h('p', null, h('strong', null, 'A short profile is fine. '),
      'A half-page resume is acceptable. A genuine course project, a club task or a volunteering stint can each add real detail when you have one.')));
  }

  view.append(
    basicsSection(profile, save),
    educationSection(profile, save),
    skillsSection(profile, save),
    languagesSection(profile, save),
    linksSection(profile, save),
    entriesSection(profile, save),
    simpleListSection(profile, save, 'achievements', 'Achievements', ['Think recognition or a clear outcome: a competition placement, certificate, scholarship or selection into a program.', 'One line of detail is enough; dates optional.', 'Leave it empty if nothing fits. Blank is better than padding.']),
    simpleListSection(profile, save, 'extracurriculars', 'Extracurriculars', ['Organized activities outside class: club member or lead, fest volunteer, NSS/NCC, sports team, community volunteering.', 'Volunteering belongs here (or under Experience if it is structured, recurring work).', 'Add a short detail that says what you actually did.']),
    hobbiesSection(profile, save),
    workSection(profile, save),
    aboutSection(profile, save)
  );
}

function card(id, title, tips, ...children) {
  return h('section', { class: 'card', id: 'sec-' + id, 'aria-labelledby': 'sec-' + id + '-h' },
    h('div', { class: 'layout with-side' },
      h('div', null, h('h2', { id: 'sec-' + id + '-h' }, title), ...children),
      tips && tips.length ? tipsCard(tips) : null));
}

// ---------- Basics ----------
function basicsSection(profile, save) {
  const b = profile.basics;
  const fullName = bindInput(b, 'fullName', { onInput: save, attrs: { autocomplete: 'name' } });
  const email = bindInput(b, 'email', { type: 'email', onInput: save, attrs: { autocomplete: 'email' } });
  const phone = bindInput(b, 'phone', { type: 'tel', placeholder: '+91 98765 43210', onInput: save, attrs: { autocomplete: 'tel' } });
  const city = bindInput(b, 'city', { onInput: save });
  const country = bindInput(b, 'country', { onInput: save });
  const headline = bindInput(b, 'headline', { placeholder: 'B.Tech ECE student | Video editor', onInput: save });

  const photoWrap = h('div');
  const renderPhoto = () => {
    clear(photoWrap);
    if (b.photoDataUrl) {
      photoWrap.append(h('img', { src: b.photoDataUrl, alt: 'Your photo', style: { width: '96px', height: '96px', objectFit: 'cover', borderRadius: '8px', display: 'block', marginBottom: '.5rem' } }),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { delete b.photoDataUrl; saveProfile(profile); renderPhoto(); toast('Photo removed'); } }, 'Remove photo'));
    }
    const input = h('input', { type: 'file', accept: 'image/*', id: 'photo-input' });
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; if (!f) return;
      await photoWarning();
      try {
        b.photoDataUrl = await downscaleImage(f, 400);
        saveProfile(profile); renderPhoto(); toast('Photo stored on this device only');
      } catch (e) { toast('Could not read that image', { kind: 'danger' }); }
    });
    photoWrap.append(field('Photo (optional)', input, { hint: 'Stored on this device only, never uploaded or sent. Used only by photo templates.' }));
  };
  renderPhoto();

  return card('basics', 'Basics', ['Use a professional email, ideally firstname.lastname.', 'Phone with country code. Never a full street address: city is enough.', 'Headline is one line, e.g. "B.Tech ECE student | Video editor".'],
    h('div', { class: 'grid-2' },
      field('Full name', fullName, { required: true }),
      field('Email', email, { required: true, hint: 'Tip: use a professional address, ideally firstname.lastname' }),
      field('Phone', phone, { hint: 'Optional, with country code' }),
      field('City', city, { hint: 'Optional' }),
      field('Country', country, { hint: 'Optional' }),
      field('Headline', headline, { hint: 'Optional, one line' })),
    photoWrap);
}

async function photoWarning() {
  const st = loadSettings();
  if (st.dontShowAgain.photo_upload) return;
  if (sessionStorage.getItem('hr.photoWarned')) return;
  sessionStorage.setItem('hr.photoWarned', '1');
  const dont = h('input', { type: 'checkbox' });
  await modal({ title: 'About photos on resumes', body: h('div', null,
    h('p', null, 'Photos and multi-column layouts may be read incorrectly by some applicant tracking systems (ATS). Photo conventions vary: discouraged in many contexts, can introduce bias, expected in some countries and roles.'),
    h('p', null, 'The photo stays on this device and only appears if you pick a photo template.'),
    h('label', { class: 'check' }, dont, h('span', null, "Don't show again"))),
    buttons: [{ label: 'OK', value: 'ok', primary: true }] });
  if (dont.checked) updateSettings({ dontShowAgain: { ...st.dontShowAgain, photo_upload: true } });
}

function downscaleImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// ---------- Education + marks ----------
function educationSection(profile, save) {
  const list = h('div');
  const marksWrap = h('div');
  const render = () => {
    clear(list);
    profile.education.forEach((ed, i) => {
      ed.coursework = Array.isArray(ed.coursework) ? ed.coursework : [];
      const course = h('input', { type: 'text', value: ed.coursework.join(', '), placeholder: 'Up to 4, comma separated' });
      course.addEventListener('input', () => { ed.coursework = course.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4); save(); });
      const year = choiceGroup({ label: 'Year of study', options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Year ${n}` })), value: ed.yearOfStudy ? String(ed.yearOfStudy) : null,
        onChange: (v) => { ed.yearOfStudy = v ? Number(v) : null; save(); renderMarks(); } });
      list.append(h('div', { class: 'item' },
        h('div', { class: 'item-head' }, h('h3', null, ed.degree || `Education ${i + 1}`),
          h('button', { type: 'button', class: 'btn small danger', onclick: async () => { if (await confirmDialog('Remove this education entry?', '', { okLabel: 'Remove', danger: true })) { profile.education.splice(i, 1); saveProfile(profile); render(); renderMarks(); } } }, 'Remove')),
        h('div', { class: 'grid-2' },
          field('Degree', bindInput(ed, 'degree', { placeholder: 'B.Tech', onInput: save })),
          field('Branch', bindInput(ed, 'branch', { placeholder: 'Electronics and Communication', onInput: save })),
          field('Institution', bindInput(ed, 'institution', { onInput: save })),
          field('Expected graduation year', bindInput(ed, 'expectedGradYear', { placeholder: '2028', onInput: save, attrs: { inputmode: 'numeric' } }))),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Year of study'), year),
        field('Relevant coursework (optional)', course, { hint: 'Up to 4 courses' })));
    });
    list.append(h('button', { type: 'button', class: 'btn', onclick: () => { profile.education.push({ id: newId(), degree: '', branch: '', institution: '', yearOfStudy: null, expectedGradYear: '', coursework: [] }); saveProfile(profile); render(); renderMarks(); } }, '+ Add education'));
  };
  const renderMarks = () => {
    clear(marksWrap);
    const m = profile.marks;
    const years = profile.education.map((e) => Number(e.yearOfStudy)).filter(Boolean);
    const firstYear = years.length > 0 && Math.max(...years) === 1;
    const later = years.length > 0 && Math.max(...years) >= 3;
    const cgpaEmpty = !(m.cgpa.value && String(m.cgpa.value).trim());
    marksWrap.append(h('h3', null, 'Marks (optional)'));
    if (firstYear && cgpaEmpty && !marksWrap.dataset.forceCgpa) {
      marksWrap.append(h('p', { class: 'muted small' }, 'First year? CGPA is hidden until you have one. You can add your 12th-grade marks instead. ',
        h('button', { type: 'button', class: 'btn link small', onclick: () => { marksWrap.dataset.forceCgpa = '1'; renderMarks(); } }, 'I already have a CGPA')));
    } else {
      const cg = h('input', { type: 'text', value: m.cgpa.value || '', placeholder: '8.2 / 10', inputmode: 'decimal' });
      cg.addEventListener('input', () => { m.cgpa.value = cg.value.trim() || null; save(); });
      marksWrap.append(field('CGPA', cg), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Show CGPA'),
        choiceGroup({ label: 'Show CGPA', options: DISPLAY_OPTIONS, value: m.cgpa.display || 'relevant', allowNone: false, onChange: (v) => { m.cgpa.display = v; save(); } }),
        h('span', { class: 'hint' }, '"Only when relevant" = when the posting asks for marks or the role family is General.')));
    }
    const tw = h('input', { type: 'text', value: m.twelfth.value || '', placeholder: '92%', inputmode: 'decimal' });
    tw.addEventListener('input', () => { m.twelfth.value = tw.value.trim() || null; save(); });
    marksWrap.append(field('12th-grade marks', tw), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Show 12th marks'),
      choiceGroup({ label: 'Show 12th marks', options: DISPLAY_OPTIONS, value: m.twelfth.display || 'relevant', allowNone: false, onChange: (v) => { m.twelfth.display = v; save(); } }),
      later && m.twelfth.display !== 'never' ? h('span', { class: 'hint' }, 'After second year, most students switch 12th marks to "Never".') : null));
  };
  render(); renderMarks();
  return card('education', 'Education', ['Degree, branch, institution, year of study and expected graduation year.', 'CGPA and 12th marks are optional and have their own display setting (default: only when relevant).', 'Coursework: up to 4 courses that actually relate to the roles you want.'], list, h('hr'), marksWrap);
}

// ---------- Skills ----------
function skillsSection(profile, save) {
  const wrap = h('div');
  const render = () => {
    clear(wrap);
    for (const cat of SKILL_CATEGORIES) {
      const mine = profile.skills.filter((s) => (s.category || 'custom') === cat.value);
      const group = h('div', { class: 'item' }, h('h3', null, cat.label));
      if (!mine.length) group.append(h('p', { class: 'muted small' }, 'None added yet.'));
      for (const sk of mine) group.append(skillRow(profile, sk, save, render));
      // quick add from catalog
      const catalogNames = (SKILL_CATALOG.length ? SKILL_CATALOG.filter((c) => c.category === cat.value).map((c) => c.name) : (CATALOG_FALLBACK[cat.value] || []))
        .filter((n) => !profile.skills.some((s) => s.name.toLowerCase() === n.toLowerCase()));
      if (catalogNames.length) {
        group.append(h('p', { class: 'muted small', style: { marginTop: '.5rem' } }, 'Tap to add:'),
          h('div', { class: 'chips' }, catalogNames.slice(0, 12).map((n) => h('button', { type: 'button', class: 'chip', onclick: () => { profile.skills.push({ id: newId(), name: n, category: cat.value, level: null, whereUsed: '', exposureNote: '' }); saveProfile(profile); render(); } }, '+ ' + n))));
      }
      if (cat.value === 'custom') {
        const inp = h('input', { type: 'text', placeholder: 'Add a skill (e.g. "Hindi voice-over", "Blender")', 'aria-label': 'Custom skill name' });
        const add = () => { const n = inp.value.trim(); if (!n) return; profile.skills.push({ id: newId(), name: n, category: 'custom', level: null, whereUsed: '', exposureNote: '' }); inp.value = ''; saveProfile(profile); render(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        group.append(h('div', { class: 'row', style: { marginTop: '.5rem' } }, inp, h('button', { type: 'button', class: 'btn', onclick: add }, 'Add custom skill')));
      }
      wrap.append(group);
    }
  };
  render();
  return card('skills', 'Skills', ['Every skill needs a level you picked and a private "Where I used it" note. Coursework, a practice project, a club task or self-learning all count.', '"Have this, AI-assisted" and "Some exposure" print as text labels, exactly as written. Nothing is ever upgraded to "proficient".', 'Interpersonal skills need a private example and are better shown through a bullet.'],
    h('p', { class: 'muted small' }, helperFor('skills').definition, ' ', helperPopover('skills', { triggerLabel: 'How levels print' , extra: h('ul', null, h('li', null, 'Have this: printed as the skill name.'), h('li', null, 'Have this, AI-assisted: grouped under an "AI-assisted" label.'), h('li', null, 'Some exposure: grouped as "Exposure: name (note)".'), h('li', null, "Don't have this: never printed.")) })),
    wrap);
}

function skillRow(profile, sk, save, rerender) {
  const row = h('div', { class: 'skill-row' });
  const details = h('div');
  const renderDetails = () => {
    clear(details);
    if (sk.level === 'have' || sk.level === 'have_ai') {
      const where = h('input', { type: 'text', value: sk.whereUsed || '', placeholder: 'e.g. Edited 6 reels for the college fest page' });
      const f = field('Where I used it (private, required)', where, { hint: 'Never printed. Coursework, a practice project, a club task or self-learning all count.' });
      const validate = () => f.setError(where.value.trim() ? '' : 'Required for "Have this": one line on where you used it.');
      where.addEventListener('input', () => { sk.whereUsed = where.value; validate(); save(); });
      validate();
      details.append(f);
    } else if (sk.level === 'exposure') {
      const note = h('input', { type: 'text', value: sk.exposureNote || '', placeholder: 'e.g. reading level, basic wireframes' });
      note.addEventListener('input', () => { sk.exposureNote = note.value; save(); });
      const where = h('input', { type: 'text', value: sk.whereUsed || '', placeholder: 'Optional' });
      where.addEventListener('input', () => { sk.whereUsed = where.value; save(); });
      details.append(field('Exposure note (printed in brackets)', note, { hint: 'Prints as "Exposure: ' + sk.name + (sk.exposureNote ? ' (' + sk.exposureNote + ')' : '') + '"' }), field('Where I saw it (private, optional)', where));
    } else if (sk.level === 'none') {
      details.append(h('p', { class: 'muted small' }, 'Never printed. Kept so the tailoring step does not ask again.'));
    } else {
      details.append(h('p', { class: 'muted small' }, 'Pick a level before this skill can appear on a resume.'));
    }
  };
  row.append(h('div', { class: 'row between' }, h('span', { class: 'name' }, sk.name),
    h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove ' + sk.name, onclick: () => { profile.skills = profile.skills.filter((s) => s.id !== sk.id); saveProfile(profile); rerender(); } }, 'Remove')));
  row.append(choiceGroup({ label: 'Level for ' + sk.name, options: LEVELS, value: sk.level, onChange: (v) => { sk.level = v; save(); renderDetails(); } }));
  renderDetails();
  row.append(details);
  return row;
}

// ---------- Languages ----------
function languagesSection(profile, save) {
  const wrap = h('div');
  const render = () => {
    clear(wrap);
    for (const lg of profile.languages) {
      wrap.append(h('div', { class: 'skill-row' },
        h('div', { class: 'row between' }, h('span', { class: 'name' }, lg.name),
          h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove ' + lg.name, onclick: () => { profile.languages = profile.languages.filter((x) => x.id !== lg.id); saveProfile(profile); render(); } }, 'Remove')),
        choiceGroup({ label: 'Level for ' + lg.name, options: LANGUAGE_LEVELS, value: lg.level, onChange: (v) => { lg.level = v; save(); } })));
    }
    const inp = h('input', { type: 'text', placeholder: 'Add a language', 'aria-label': 'Language name' });
    const add = () => { const n = inp.value.trim(); if (!n) return; profile.languages.push({ id: newId(), name: n, level: null }); inp.value = ''; saveProfile(profile); render(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    wrap.append(h('div', { class: 'row', style: { marginTop: '.5rem' } }, inp, h('button', { type: 'button', class: 'btn', onclick: add }, 'Add language')));
  };
  render();
  return card('languages', 'Languages (spoken)', ['Printed only when a level is set, as "English (Fluent), Hindi (Native)".', 'Be honest about Conversational vs Fluent; interviews happen in these languages.'], wrap);
}

// ---------- Links ----------
function linksSection(profile, save) {
  const l = profile.links;
  const driveHint = h('span', { class: 'hint' });
  const portfolio = bindInput(l, 'portfolio', { type: 'url', placeholder: 'Drive, YouTube, Behance or your site', onInput: (v) => { save(); driveHint.textContent = /drive\.google|docs\.google/i.test(v) ? 'Drive link: set sharing to "Anyone with the link can view" before you send the resume.' : ''; } });
  driveHint.textContent = /drive\.google|docs\.google/i.test(l.portfolio || '') ? 'Drive link: set sharing to "Anyone with the link can view" before you send the resume.' : '';
  return card('links', 'Links', ['LinkedIn appears on every version if present. GitHub on software roles. Portfolio on editing, design and content roles.', 'If a posting asks for a link you have, it shows regardless of role. You can also toggle any link in the preview.', 'Missing links are simply omitted. Nobody will ask you to create an account.'],
    h('div', { class: 'grid-2' },
      field('LinkedIn', bindInput(l, 'linkedin', { type: 'url', placeholder: 'https://linkedin.com/in/...', onInput: save })),
      field('GitHub', bindInput(l, 'github', { type: 'url', placeholder: 'https://github.com/...', onInput: save })),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'link-portfolio' }, 'Portfolio'), (portfolio.id = 'link-portfolio', portfolio), driveHint)));
}

// ---------- Experience & projects ----------
function entriesSection(profile, save) {
  const wrap = h('div');
  const render = () => {
    clear(wrap);
    if (!profile.entries.length) wrap.append(h('p', { class: 'muted' }, 'No entries yet. A genuine course project or a club task counts: add it as a project.'));
    profile.entries.forEach((e, i) => wrap.append(entryCard(profile, e, i, save, render)));
    wrap.append(h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: () => addEntry('project') }, '+ Add project'),
      h('button', { type: 'button', class: 'btn', onclick: () => addEntry('experience') }, '+ Add experience')));
  };
  const addEntry = (kind) => {
    profile.entries.push({ id: newId(), kind, title: '', organization: kind === 'project' ? 'Personal project' : '', role: '', start: '', end: '',
      bullets: [{ id: newId(), text: '' }, { id: newId(), text: '' }],
      result: { text: '', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' } });
    saveProfile(profile); render();
  };
  render();
  return card('entries', 'Experience & projects', ['Two to four things you actually did, each starting with an action verb, one idea, about 110 characters.', 'Numbers print only with evidence or your explicit confirmation plus a private source note.', 'Entries are held back by default; you choose which ones go on each resume.'], wrap);
}

function entryCard(profile, e, i, save, rerender) {
  e.bullets = Array.isArray(e.bullets) ? e.bullets : [];
  e.result = e.result || { text: '', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' };
  e.result.evidence = e.result.evidence || { kind: 'none', value: '' };
  const titleEl = h('h3', null, e.title || (e.kind === 'project' ? 'Project' : 'Experience'));
  const dateHint = h('span', { class: 'hint' });
  const updDate = () => { dateHint.textContent = e.start ? 'Prints as "' + formatDateRange(e.start, e.end || '') + '"' : ''; };
  const start = h('input', { type: 'month', value: e.start || '' });
  start.addEventListener('input', () => { e.start = start.value; save(); updDate(); });
  const end = h('input', { type: 'month', value: e.end === 'present' ? '' : (e.end || ''), disabled: e.end === 'present' });
  end.addEventListener('input', () => { e.end = end.value; save(); updDate(); });
  const present = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: e.end === 'present', onchange: (ev) => { if (ev.target.checked) { e.end = 'present'; end.disabled = true; end.value = ''; } else { e.end = ''; end.disabled = false; } save(); updDate(); } }), h('span', null, 'Present'));
  updDate();

  const bulletsWrap = h('div');
  const renderBullets = () => {
    clear(bulletsWrap);
    e.bullets.forEach((b, bi) => {
      const ta = h('textarea', { rows: '2', value: b.text, 'aria-label': `Bullet ${bi + 1}`, placeholder: 'Edited 6 reels for the fest page using DaVinci Resolve' });
      const counter = charCounter(ta, BULLET_MAX);
      ta.addEventListener('input', () => { b.text = ta.value; save(); });
      bulletsWrap.append(h('div', { class: 'bullet-row' }, h('div', null, ta, counter),
        h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove bullet', disabled: e.bullets.length <= 2, onclick: () => { e.bullets.splice(bi, 1); saveProfile(profile); renderBullets(); } }, 'Remove')));
    });
    if (e.bullets.length < 4) bulletsWrap.append(h('button', { type: 'button', class: 'btn small', onclick: () => { e.bullets.push({ id: newId(), text: '' }); saveProfile(profile); renderBullets(); } }, '+ Add bullet'));
  };
  renderBullets();

  const r = e.result;
  const evidenceValue = h('input', { type: 'text', value: r.evidence.value || '', placeholder: 'Link, certificate name or the number' });
  evidenceValue.addEventListener('input', () => { r.evidence.value = evidenceValue.value; save(); });
  const evidenceField = field('Evidence', evidenceValue);
  const statusWrap = h('div', { class: 'field' }, h('span', { class: 'label' }, 'Status of any number in the result'),
    choiceGroup({ label: 'Number status', options: [{ value: 'evidence', label: 'Evidence attached' }, { value: 'confirmed', label: 'Student-confirmed' }, { value: 'unconfirmed', label: 'Unconfirmed' }], value: r.numberStatus || 'unconfirmed', allowNone: false, onChange: (v) => { r.numberStatus = v; save(); } }),
    h('span', { class: 'hint' }, 'Unconfirmed numbers are never printed.'));
  const refreshEvidence = () => { evidenceField.hidden = r.evidence.kind === 'none'; };
  refreshEvidence();

  return h('div', { class: 'item' },
    h('div', { class: 'item-head' }, titleEl,
      h('button', { type: 'button', class: 'btn small danger', onclick: async () => { if (await confirmDialog('Remove this entry?', '', { okLabel: 'Remove', danger: true })) { profile.entries.splice(i, 1); saveProfile(profile); rerender(); } } }, 'Remove')),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Kind'), choiceGroup({ label: 'Kind', options: [{ value: 'experience', label: 'Experience' }, { value: 'project', label: 'Project' }], value: e.kind, allowNone: false, onChange: (v) => { e.kind = v; save(); } })),
    h('div', { class: 'grid-2' },
      field('Title', bindInput(e, 'title', { onInput: (v) => { titleEl.textContent = v || 'Entry'; save(); } }), { required: true }),
      field('Organization', bindInput(e, 'organization', { placeholder: 'Or "Personal project"', onInput: save })),
      field('Your role', bindInput(e, 'role', { placeholder: 'Editor, Member, Developer...', onInput: save })),
      h('div', null, h('div', { class: 'grid-2' }, field('Start', start), field('End', end)), present, dateHint)),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'What you did (2-4 bullets)'), bulletsWrap),
    h('details', null, h('summary', { class: 'btn small', style: { display: 'inline-flex' } }, 'Result and evidence (optional)'),
      field('Result', bindInput(r, 'text', { placeholder: 'e.g. Reels reached about 2,000 views', onInput: save })),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Evidence kind'), choiceGroup({ label: 'Evidence kind', options: [{ value: 'none', label: 'None' }, { value: 'link', label: 'Link' }, { value: 'certificate', label: 'Certificate' }, { value: 'number', label: 'Number' }], value: r.evidence.kind || 'none', allowNone: false, onChange: (v) => { r.evidence.kind = v; save(); refreshEvidence(); } })),
      evidenceField,
      statusWrap,
      field('Source note (private)', bindInput(r, 'sourceNote', { placeholder: 'How you know this number', onInput: save }), { hint: 'Never printed.' })));
}

// ---------- Achievements / Extracurriculars ----------
function simpleListSection(profile, save, key, title, tips) {
  const wrap = h('div');
  const render = () => {
    clear(wrap);
    if (!profile[key].length) wrap.append(h('p', { class: 'muted small' }, 'Optional. ', helperFor(key).definition));
    profile[key].forEach((it, i) => wrap.append(h('div', { class: 'item' },
      h('div', { class: 'grid-2' },
        field('Name', bindInput(it, 'name', { onInput: save })),
        field('Date (optional)', bindInput(it, 'date', { placeholder: 'Mar 2025', onInput: save }))),
      field('Detail (optional, one line)', bindInput(it, 'detail', { onInput: save })),
      h('button', { type: 'button', class: 'btn small danger', onclick: () => { profile[key].splice(i, 1); saveProfile(profile); render(); } }, 'Remove'))));
    wrap.append(h('div', { class: 'row', style: { marginTop: '.5rem' } },
      h('button', { type: 'button', class: 'btn', onclick: () => { profile[key].push({ id: newId(), name: '', date: '', detail: '' }); saveProfile(profile); render(); } }, '+ Add'),
      helperPopover(key)));
  };
  render();
  return card(key, title, tips, wrap);
}

// ---------- Hobbies ----------
function hobbiesSection(profile, save) {
  const wrap = h('div');
  const isFiller = (name) => { const n = String(name || '').toLowerCase(); return FILLER_HOBBIES.some((f) => n.includes(f)); };
  const isVolunteering = (name, detail) => /volunt|nss\b|ncc\b|community service/i.test(`${name} ${detail}`);
  const render = () => {
    clear(wrap);
    profile.hobbies.forEach((hb, i) => {
      const warn = h('div', { class: 'small', 'aria-live': 'polite' });
      const upd = () => {
        clear(warn);
        if (isFiller(hb.name)) warn.append(h('span', { class: 'status-partial' }, 'This reads like a filler. A hands-on activity with a small detail says more. '));
        if (isVolunteering(hb.name, hb.detail)) warn.append(h('span', null, 'Volunteering belongs under Extracurriculars. '),
          h('button', { type: 'button', class: 'btn link small', onclick: () => { profile.extracurriculars.push({ id: newId(), name: hb.name, date: '', detail: hb.detail || '' }); profile.hobbies.splice(i, 1); saveProfile(profile); render(); toast('Moved to Extracurriculars'); } }, 'Move it'));
      };
      wrap.append(h('div', { class: 'item' },
        h('div', { class: 'grid-2' },
          field('Hobby', bindInput(hb, 'name', { onInput: () => { save(); upd(); } })),
          field('Tiny detail (optional)', bindInput(hb, 'detail', { placeholder: 'trying regional recipes', onInput: () => { save(); upd(); } }))),
        warn,
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { profile.hobbies.splice(i, 1); saveProfile(profile); render(); } }, 'Remove')));
      upd();
    });
    if (profile.hobbies.length > 4) wrap.append(h('p', { class: 'muted small' }, 'Only up to 4 go on a resume; you pick which ones in the Tailor step. The rest stay here.'));
    const inp = h('input', { type: 'text', placeholder: 'Add a hobby', 'aria-label': 'Hobby name' });
    const add = (name) => { const n = (name ?? inp.value).trim(); if (!n) return; profile.hobbies.push({ id: newId(), name: n, detail: '' }); inp.value = ''; saveProfile(profile); render(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    wrap.append(h('div', { class: 'row', style: { marginTop: '.5rem' } }, inp, h('button', { type: 'button', class: 'btn', onclick: () => add() }, 'Add hobby'), helperPopover('hobbies')));
    const quick = HOBBY_EXAMPLES.map((x) => x.name.replace(/\s*\(.*\)$/, '')).filter((n) => !profile.hobbies.some((hb) => hb.name.toLowerCase() === n.toLowerCase()));
    if (quick.length) wrap.append(h('p', { class: 'muted small', style: { marginTop: '.5rem' } }, 'Tap to add:'), h('div', { class: 'chips' }, quick.map((n) => h('button', { type: 'button', class: 'chip', onclick: () => add(n) }, '+ ' + n))));
  };
  render();
  const info = helperFor('hobbies');
  return card('hobbies', info.label || 'Hobbies (optional, up to 4, 2 recommended)', ['Keep it short (2-4) and add a tiny detail: "Cooking (trying regional recipes)".', 'Be honest; skip fillers like "listening to music" or "hanging out with friends".', 'Volunteering is an extracurricular, never a hobby.'],
    h('p', { class: 'muted small' }, info.definition), wrap);
}

// ---------- Work preference ----------
function workSection(profile, save) {
  const w = profile.work;
  return card('work', 'Work preference and availability', ['Printed only when the posting asks about them.', 'A mismatch with the role\'s work mode shows up in your private summary only.'],
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Preference'), choiceGroup({ label: 'Work preference', options: WORK_PREFS, value: w.preference || 'none', allowNone: false, onChange: (v) => { w.preference = v; save(); } })),
    h('div', { class: 'grid-2' },
      field('Hours per week', bindInput(w, 'hoursPerWeek', { type: 'number', placeholder: '15', onInput: save, attrs: { min: '1', max: '60' } })),
      field('Earliest start date (optional)', bindInput(w, 'startDate', { type: 'date', onInput: save }))));
}

// ---------- About Me ----------
function aboutSection(profile, save) {
  const ta = h('textarea', { rows: '4', value: profile.aboutMe || '', placeholder: 'Blank by default. Write it yourself or tap a structure below and fill in the blanks.' });
  const counter = charCounter(ta, ABOUT_MAX);
  ta.addEventListener('input', () => { profile.aboutMe = ta.value; save(); });
  const info = helperFor('aboutMe');
  const structures = info.structures.length ? info.structures : ['[Year] [degree] student with hands-on experience in [confirmed skill], seeking [role type] where I can [what you will contribute].'];
  return card('about', 'About Me (optional)', ['2-3 lines, about 300 characters. Only printed if you write or approve it.', 'Mention only skills you marked "Have this".', 'No pronouns needed; start with who you are.'],
    h('p', { class: 'muted small' }, info.definition),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'about-me' }, 'About Me'), (ta.id = 'about-me', ta), counter),
    h('p', { class: 'muted small' }, 'Fill-in-the-blank structures (tap to insert):'),
    h('div', { class: 'chips' }, structures.map((s) => h('button', { type: 'button', class: 'chip', onclick: () => { ta.value = s; profile.aboutMe = s; save(); ta.dispatchEvent(new Event('input')); ta.focus(); } }, s))));
}
