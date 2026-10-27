// Rules & ATS comparison page (SPEC 14.5): two live thumbnails, the comparison table, the ATS checklist.
import { h, clear } from '../ui.js';
import { renderResume } from '../render.js';
import { ATS_CHECKLIST } from '../catalog.js';
import { loadProfile, isProfileEmpty } from '../store.js';
import { newSession } from '../session.js';
import { buildResume } from '../core/tailor.js';

const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#cfd8e3"/><circle cx="48" cy="38" r="18" fill="#8a9bb0"/><rect x="18" y="62" width="60" height="34" rx="14" fill="#8a9bb0"/></svg>');

/** Built-in sample ResumeModel used when the student has no profile yet. */
export function sampleModel(pageSize = 'A4') {
  const src = (type, id) => ({ type, id });
  return {
    pageSize, template: 'text_first', family: 'software_web',
    header: {
      name: 'Asha Verma',
      contactLine: [{ text: 'asha.verma@example.com', src: src('basics', 'email') }, { text: '+91 98765 00000', src: src('basics', 'phone') }, { text: 'Pune, India', src: src('basics', 'city') }],
      links: [{ label: 'LinkedIn', url: 'linkedin.com/in/ashaverma', src: src('link', 'linkedin') }, { label: 'GitHub', url: 'github.com/ashaverma', src: src('link', 'github') }],
      photoDataUrl: SAMPLE_PHOTO
    },
    sections: [
      { key: 'skills', title: 'Skills', items: [
        { id: 'sk-prog', src: src('skill', 'g1'), heading: 'Programming', lines: [{ id: 'l1', text: 'Python, C', src: src('skill', 's1') }] },
        { id: 'sk-ai', src: src('skill', 'g2'), heading: 'Web (AI-assisted)', lines: [{ id: 'l2', text: 'HTML, CSS, JavaScript', src: src('skill', 's2') }] },
        { id: 'sk-exp', src: src('skill', 'g3'), heading: 'Exposure', lines: [{ id: 'l3', text: 'Figma (basic wireframes)', src: src('skill', 's3') }] },
        { id: 'sk-core', src: src('skill', 'g4'), heading: 'Core', lines: [{ id: 'l4', text: 'Teamwork, time management', src: src('skill', 's4') }] }
      ] },
      { key: 'projects', title: 'Projects', items: [
        { id: 'p1', src: src('entry', 'e1'), heading: 'Attendance tracker web app', sub: 'Personal project - Developer', dateRange: 'Jan 2025 - Mar 2025', lines: [
          { id: 'b1', text: 'Built a web page that records class attendance and shows a weekly summary', src: src('bullet', 'b1') },
          { id: 'b2', text: 'Wrote the Python script that exports the summary to a spreadsheet', src: src('bullet', 'b2') },
          { id: 'b3', text: 'Tested the page with 5 classmates and fixed the issues they found', src: src('bullet', 'b3') }
        ] }
      ] },
      { key: 'experience', title: 'Experience', items: [
        { id: 'x1', src: src('entry', 'e2'), heading: 'Tech club volunteer', sub: 'College coding club - Member', dateRange: 'Aug 2024 - Present', lines: [
          { id: 'b4', text: 'Coordinated a weekend workshop for first-year students with two other members', src: src('bullet', 'b4') },
          { id: 'b5', text: 'Prepared the practice tasks and answered questions during the session', src: src('bullet', 'b5') }
        ] }
      ] },
      { key: 'education', title: 'Education', items: [
        { id: 'ed1', src: src('education', 'ed1'), heading: 'B.Tech, Computer Engineering', sub: 'Example Institute of Technology', dateRange: 'Expected 2028', lines: [{ id: 'l5', text: 'Second year', src: src('education', 'ed1') }] }
      ] },
      { key: 'extracurriculars', title: 'Extracurriculars', items: [
        { id: 'ex1', src: src('extracurricular', 'ex1'), heading: 'NSS volunteer', dateRange: '2024', lines: [{ id: 'l6', text: 'Weekend community clean-up drives', src: src('extracurricular', 'ex1') }] }
      ] },
      { key: 'hobbies', title: 'Hobbies', items: [{ id: 'hb', src: src('hobby', 'h1'), lines: [{ id: 'l7', text: 'Chess (online league)', src: src('hobby', 'h1') }, { id: 'l8', text: 'Cooking (regional recipes)', src: src('hobby', 'h2') }] }] },
      { key: 'languages', title: 'Languages', items: [{ id: 'lg', src: src('language', 'lg'), lines: [{ id: 'l9', text: 'English (Fluent), Hindi (Native)', src: src('language', 'lg') }] }] }
    ],
    trims: [], warnings: []
  };
}

/** Use the student's own data when they have a profile; otherwise the sample. */
export function comparisonModel() {
  const profile = loadProfile();
  if (isProfileEmpty(profile)) return sampleModel(profile.settings?.pageSize || 'A4');
  try {
    const s = newSession();
    s.role.title = 'Sample role'; s.role.company = 'Sample company';
    s.selection = {
      entryIds: (profile.entries || []).slice(0, 3).map((e) => e.id),
      achievementIds: (profile.achievements || []).slice(0, 2).map((e) => e.id),
      extracurricularIds: (profile.extracurriculars || []).slice(0, 2).map((e) => e.id),
      hobbyIds: (profile.hobbies || []).slice(0, 4).map((e) => e.id),
      includeAboutMe: Boolean(profile.aboutMe), aboutMeText: profile.aboutMe || ''
    };
    s.linkOverrides = { linkedin: true, github: true, portfolio: true };
    const m = buildResume(profile, s);
    if (m && m.header) {
      if (!m.header.photoDataUrl) m.header.photoDataUrl = profile.basics?.photoDataUrl || SAMPLE_PHOTO;
      return m;
    }
  } catch (e) { console.warn('buildResume failed for comparison; using sample', e); }
  return sampleModel(profile.settings?.pageSize || 'A4');
}

function thumb(model, templateId, caption) {
  const pageSize = model.pageSize || 'A4';
  const inner = h('div', { class: 'thumb-inner' }, renderResume(model, templateId, pageSize));
  const box = h('div', { class: 'thumb', 'aria-label': caption }, h('div', { class: 'thumb-caption' }, caption), inner);
  const fit = () => {
    const page = inner.firstElementChild;
    const w = page.offsetWidth || 794; const hgt = page.offsetHeight || 1123;
    const scale = Math.min(1, (box.clientWidth || 360) / w);
    inner.style.transform = `scale(${scale})`;
    inner.style.height = `${hgt * scale}px`;
    inner.style.width = `${w}px`;
  };
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  return box;
}

export function comparisonTable() {
  const rows = [
    ['ATS parsing', 'Generally reliable', 'May misread columns, sidebars and icons'],
    ['Human skim-reading', 'Clean, predictable', 'Eye-catching, shows design sense'],
    ['Best for', 'Online portals, software, general, operations', 'Direct email to a designer, editor or creative lead'],
    ['Risks', 'Can look plain', 'Parsing errors, photo bias, wasted space'],
    ['Photo convention', 'Not needed', 'Expected in some countries, discouraged in others'],
    ['Printing', 'Clean', 'Colour blocks may print poorly'],
    ['Honest-level display', 'Text labels', 'Must still use text labels, never bars']
  ];
  return h('table', { class: 'compare' },
    h('thead', null, h('tr', null, h('th', null, 'Aspect'), h('th', null, 'Text-first'), h('th', null, 'Visual / photo'))),
    h('tbody', null, rows.map((r) => h('tr', null, h('th', { scope: 'row' }, r[0]), h('td', null, r[1]), h('td', null, r[2])))));
}

export function atsChecklist() {
  return h('ul', null, ATS_CHECKLIST.map((t) => h('li', null, t)));
}

export function renderRules(view) {
  clear(view);
  const model = comparisonModel();
  view.append(h('div', { class: 'page-title' }, h('h1', null, 'Rules & ATS'),
    h('span', { class: 'muted small' }, 'Same content, two layouts. Pick with your eyes open.')));
  view.append(h('div', { class: 'card' },
    h('p', null, 'An applicant tracking system (ATS) is software some employers use to read resumes before a person does. ',
      'No template here is "ATS-friendly" or "guaranteed to pass"; the text-first layout is simply the safer choice for online portals. ',
      'There is no absolute rule against photos: conventions vary by country and role.'),
    h('div', { class: 'thumbs' },
      thumb(model, 'text_first', 'Text-first, single column, no photo'),
      thumb(model, 'two_column_photo', 'Visual, two-column with photo'))));
  view.append(h('div', { class: 'card' }, h('h2', null, 'Comparison'), comparisonTable()));
  view.append(h('div', { class: 'card' }, h('h2', null, 'ATS checklist'), atsChecklist()));
  view.append(h('div', { class: 'card' }, h('h2', null, 'What every template guarantees here'),
    h('ul', null,
      h('li', null, 'Every printed line traces to a confirmed entry in your profile.'),
      h('li', null, 'Skill levels are text labels: "AI-assisted" and "Exposure: (reading level)" stay exactly as written. No bars, dots, stars or percentages.'),
      h('li', null, 'Contact details sit in the body text. Icons, where used, are paired with text.'),
      h('li', null, 'Logical reading order even in two columns: header, main content, then sidebar.'),
      h('li', null, 'One date format: Jan 2025 - Present. Standard fonts, body 10.5 pt, sidebar 10 pt, margins 0.6 in.'))));
}
