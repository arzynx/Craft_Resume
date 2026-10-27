/**
 * Shared fixtures for the core tests. Not a test file itself.
 */
import { newProfile, newSession } from '../core/schema.js';
import { extractFromText } from '../core/extract.js';

export const VIDEO_JD = `Video Editor Intern (Remote)
Location: Bengaluru
Duration: 3 months, stipend Rs 8,000 per month
Requirements:
- Strong hands-on experience with DaVinci Resolve or Premiere Pro
- Colour grading and basic sound design
- Must have an eye for typography and pacing
- Portfolio / showreel link required
Nice to have:
- After Effects or motion graphics
- Canva for thumbnails
Availability: at least 20 hours per week; immediate joiners preferred.
Apply by sending your showreel and LinkedIn profile.`;

export const FRONTEND_JD = `Frontend Developer Intern
We are a Bengaluru-based startup building dashboards. Hybrid (3 days in office).
Requirements:
- Solid HTML, CSS and JavaScript fundamentals
- Experience with React
- Git and GitHub workflow; share your GitHub profile
- Pursuing B.Tech / BCA, 2nd or 3rd year
Nice to have:
- TypeScript
- Figma handoff experience
Stipend: ₹15,000/month, 6-month internship`;

/**
 * Set a prefilled skill's level and private note.
 */
export function setSkill(profile, name, level, whereUsed = '', exposureNote = '') {
  const s = profile.skills.find((x) => x.name === name);
  if (!s) throw new Error(`fixture: skill ${name} not prefilled`);
  s.level = level;
  s.whereUsed = whereUsed;
  s.exposureNote = exposureNote;
  return s;
}

/**
 * A realistic second-year student profile.
 */
export function makeProfile() {
  const p = newProfile();
  p.basics = { ...p.basics, fullName: 'Asha Rao', email: 'asha.rao@example.com', phone: '+91 98765 43210', city: 'Pune', country: 'India' };
  p.education.push({ id: 'edu1', degree: 'B.Tech', branch: 'ECE', institution: 'XYZ Institute', yearOfStudy: 2, expectedGradYear: 2029, coursework: ['Signals', 'Digital design'] });
  p.marks.cgpa.value = '8.4';
  setSkill(p, 'DaVinci Resolve', 'have', 'Edited reels for the college fest page');
  setSkill(p, 'Canva', 'have', 'Fest posters');
  setSkill(p, 'Figma', 'have', 'Club app mockup');
  setSkill(p, 'HTML', 'have', 'Portfolio site');
  setSkill(p, 'JavaScript', 'have_ai', 'Portfolio site built with ChatGPT help');
  setSkill(p, 'Python', 'exposure', '', 'reading level');
  setSkill(p, 'Communication', 'have', 'Anchored the fest');
  setSkill(p, 'CSS', 'have', ''); // have without whereUsed -> must not print
  // 'C/C++' stays null -> must not print
  p.languages[0].level = 'fluent';
  p.languages[1].level = 'native';
  p.links = { linkedin: 'https://linkedin.com/in/asha', github: 'https://github.com/asha', portfolio: 'https://asha.site' };
  p.work = { preference: 'remote', hoursPerWeek: '20', startDate: '2026-06' };
  p.entries.push({
    id: 'e1', kind: 'project', title: 'Fest Reels Series', organization: 'Personal project', role: 'Editor', start: '2025-01', end: '2025-03',
    bullets: [
      { id: 'b1', text: 'Edited 12 short reels in DaVinci Resolve for the fest page' },
      { id: 'b2', text: 'Graded footage to a consistent warm look' },
      { id: 'b3', text: 'Designed title cards in Canva' },
    ],
    result: { text: 'Reels reached 15,000 views', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' },
  });
  p.entries.push({
    id: 'e2', kind: 'experience', title: 'Media Team Volunteer', organization: 'College Cultural Club', role: 'Volunteer', start: '2024-08', end: 'present',
    bullets: [
      { id: 'b4', text: 'Filmed campus events as camera operator' },
      { id: 'b5', text: 'Coordinated shoot schedules with volunteers' },
      { id: 'b6', text: 'Published weekly recaps' },
      { id: 'b7', text: 'Managed the gear checklist' },
    ],
    result: { text: 'Club page followers grew', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' },
  });
  p.entries.push({
    id: 'e3', kind: 'project', title: 'Portfolio Site', organization: 'Personal project', role: 'Developer', start: '2025-05', end: '2025-06',
    bullets: [
      { id: 'b8', text: 'Built a single-page portfolio with HTML and JavaScript' },
      { id: 'b9', text: 'Deployed the site on GitHub Pages' },
    ],
    result: { text: 'Loads in under 1 second on mobile', evidence: { kind: 'link', value: 'https://asha.site' }, numberStatus: 'evidence', sourceNote: 'Lighthouse report' },
  });
  p.hobbies.push({ id: 'h1', name: 'Cooking', detail: 'regional recipes' }, { id: 'h2', name: 'Chess', detail: '' }, { id: 'h3', name: 'Cycling', detail: '' }, { id: 'h4', name: 'Reading', detail: '' }, { id: 'h5', name: 'Sketching', detail: '' });
  p.extracurriculars.push({ id: 'x1', name: 'NSS volunteer', date: '2024', detail: 'Weekend drives' }, { id: 'x2', name: 'Photography club', date: '', detail: '' });
  p.achievements.push({ id: 'a1', name: '2nd place, campus reel contest', date: '2025', detail: '' });
  return p;
}

/**
 * A session for the given JD with everything selected.
 */
export function makeSession({ company = 'Acme Studios', title = 'Video Editor Intern', jdText = VIDEO_JD, source = 'job_portal' } = {}) {
  const s = newSession({ company, title, jdText, source });
  s.extraction = extractFromText({ title, jdText });
  s.family = { primary: s.extraction.suggestedFamily.primary, secondary: s.extraction.suggestedFamily.secondary };
  s.selection = { entryIds: ['e1', 'e2', 'e3'], achievementIds: ['a1'], extracurricularIds: ['x1', 'x2'], hobbyIds: ['h1', 'h2', 'h3', 'h4', 'h5'], includeAboutMe: true, aboutMeText: 'Second-year ECE student who edits reels and builds small websites.' };
  s.numberConfirmations = { b1: { confirmed: true, sourceNote: 'Counted on the fest page' } };
  return s;
}

export function section(model, key) {
  return model.sections.find((s) => s.key === key) || null;
}

export function sectionKeys(model) {
  return model.sections.map((s) => s.key);
}

export function allLines(model) {
  return model.sections.flatMap((s) => s.items.flatMap((it) => it.lines));
}
