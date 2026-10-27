// Dev-only: seeds a sample profile and a tailoring session at the preview step.
// Loaded lazily by app.js when the page is opened with ?smoke=full and the profile is empty.
import { newProfile, newId } from './core/schema.js';
import { saveProfile, loadProfile } from './store.js';
import { newSession, saveSession, setCurrentSession } from './session.js';
import { extractRequirements } from './api.js';

export async function seedSample() {
  const p = newProfile();
  p.basics = { ...p.basics, fullName: 'Asha Verma', email: 'asha.verma@example.com', phone: '+91 98765 00000', city: 'Pune', country: 'India', headline: 'B.Tech CSE student | Web developer' };
  p.education.push({ id: newId(), degree: 'B.Tech', branch: 'Computer Engineering', institution: 'Example Institute of Technology', yearOfStudy: 2, expectedGradYear: '2028', coursework: ['Data Structures', 'Web Development'] });
  p.marks.cgpa = { value: '8.2', display: 'relevant' };
  const setSkill = (name, level, whereUsed, exposureNote = '') => {
    let sk = p.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!sk) { sk = { id: newId(), name, category: 'custom', level: null, whereUsed: '', exposureNote: '' }; p.skills.push(sk); }
    sk.level = level; sk.whereUsed = whereUsed; sk.exposureNote = exposureNote;
  };
  setSkill('Python', 'have', 'Course assignments and the attendance tracker export script');
  setSkill('JavaScript', 'have_ai', 'Attendance tracker front end, with AI help for the fetch code');
  setSkill('HTML/CSS', 'have_ai', 'Attendance tracker pages');
  setSkill('Figma', 'exposure', '', 'basic wireframes');
  setSkill('Teamwork and collaboration', 'have', 'Coding club workshop with two other members');
  p.languages.forEach((l) => { l.level = l.name === 'Hindi' ? 'native' : 'fluent'; });
  p.links.linkedin = 'https://linkedin.com/in/ashaverma'; p.links.github = 'https://github.com/ashaverma';
  p.entries.push({ id: 'e1', kind: 'project', title: 'Attendance tracker web app', organization: 'Personal project', role: 'Developer', start: '2025-01', end: '2025-03',
    bullets: [{ id: 'b1', text: 'Built a web page that records class attendance and shows a weekly summary' }, { id: 'b2', text: 'Wrote the Python script that exports the summary to a spreadsheet' }, { id: 'b3', text: 'Tested the page with 5 classmates and fixed the issues they found' }],
    result: { text: '', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' } });
  p.entries.push({ id: 'e2', kind: 'experience', title: 'Tech club volunteer', organization: 'College coding club', role: 'Member', start: '2024-08', end: 'present',
    bullets: [{ id: 'b4', text: 'Coordinated a weekend workshop for first-year students with two other members' }, { id: 'b5', text: 'helped prepare the practice tasks and answered questions during the session' }],
    result: { text: '', evidence: { kind: 'none', value: '' }, numberStatus: 'unconfirmed', sourceNote: '' } });
  p.extracurriculars.push({ id: 'x1', name: 'NSS volunteer', date: '2024', detail: 'Weekend community clean-up drives' });
  p.achievements.push({ id: 'a1', name: '2nd place, college hackathon', date: 'Mar 2025', detail: 'Built a campus lost-and-found prototype in 24 hours' });
  p.hobbies.push({ id: 'h1', name: 'Chess', detail: 'online league' }, { id: 'h2', name: 'Cooking', detail: 'regional recipes' });
  p.aboutMe = 'Second-year B.Tech student with hands-on experience in Python and web development, seeking a frontend internship where I can build and test real pages.';
  saveProfile(p);

  const s = newSession();
  s.role = { ...s.role, company: 'Example Labs', title: 'Frontend developer intern', source: 'linkedin',
    jdText: 'We are looking for a frontend intern. Must have: HTML, CSS, JavaScript, Git. Nice to have: React, Figma, Python. Remote, 3 months, stipend 10,000 per month. Share your GitHub profile.' };
  const { extraction, mode } = await extractRequirements({ title: s.role.title, jdText: s.role.jdText, useAI: false });
  s.extraction = extraction; s.ui.mode = mode; s.ui.extractedFor = `${s.role.title}\n${s.role.jdText}`;
  s.family = { primary: extraction.suggestedFamily?.primary || 'software_web', secondary: null };
  s.selection = { entryIds: ['e1', 'e2'], achievementIds: ['a1'], extracurricularIds: ['x1'], hobbyIds: ['h1', 'h2'], includeAboutMe: true, aboutMeText: p.aboutMe };
  s.ui.step = 5;
  saveSession(s); setCurrentSession(s.id);
  return `profile ${loadProfile().basics.fullName}, session ${s.id}, ${extraction.requirements.length} requirements (${mode}), family ${s.family.primary}`;
}
