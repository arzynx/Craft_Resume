import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResume } from '../core/tailor.js';
import { checkIntegrity } from '../core/integrity.js';
import { makeProfile, makeSession, section, sectionKeys, allLines, FRONTEND_JD } from './_fixtures.js';

const skillLines = (model) => section(model, 'skills').items[0].lines;
const lineText = (model, id) => skillLines(model).find((l) => l.id === id)?.text;

test('software_web: GitHub shown, Figma omitted unless mentioned, programming first, exposure grouping', () => {
  const p = makeProfile();
  const s = makeSession({ company: 'Dashly', title: 'Frontend Developer Intern', jdText: FRONTEND_JD });
  assert.equal(s.family.primary, 'software_web');

  // Posting mentions Figma -> design tools stay
  const withFigma = buildResume(p, s);
  assert.ok(withFigma.header.links.some((l) => l.label === 'GitHub'));
  assert.ok(withFigma.header.links.some((l) => l.label === 'LinkedIn'));
  assert.ok(!withFigma.header.links.some((l) => l.label === 'Portfolio'), 'portfolio not a software default and not requested');
  assert.match(lineText(withFigma, 'skills-have'), /Figma/);

  // Same posting with design tools not mentioned -> Figma, Canva, DaVinci dropped
  const s2 = structuredClone(s);
  s2.extraction.designToolsMentioned = false;
  const m = buildResume(p, s2);
  const have = lineText(m, 'skills-have');
  assert.doesNotMatch(have, /Figma|Canva|DaVinci/);
  assert.ok(have.startsWith('HTML'), `programming skills first, got: ${have}`);
  assert.match(have, /Communication/);
  assert.doesNotMatch(have, /CSS/, 'have without whereUsed never prints');
  assert.doesNotMatch(have, /C\/C\+\+/, 'level null never prints');
  assert.equal(lineText(m, 'skills-ai'), 'AI-assisted: JavaScript');
  assert.equal(lineText(m, 'skills-exposure'), 'Exposure: Python (reading level)');
  for (const l of skillLines(m)) {
    assert.equal(l.src.type, 'skill');
    assert.ok(Array.isArray(l.srcs) && l.srcs.length > 0);
  }

  // Education is prominent because the posting mentions degree / year -> right after skills
  const keys = sectionKeys(m);
  assert.equal(keys[keys.indexOf('skills') + 1], 'education');
  const edu = section(m, 'education').items[0];
  assert.equal(edu.heading, 'B.Tech ECE');
  assert.match(edu.sub, /XYZ Institute/);
  assert.ok(!edu.lines.some((l) => /CGPA/.test(l.text)), 'cgpa display=relevant and posting does not ask for marks');

  // The model is integrity clean apart from verb warnings
  const check = checkIntegrity(m, p, s2);
  assert.equal(check.ok, true, JSON.stringify(check.violations));
});

test('editing_video: order, compact education, portfolio link, hobbies max 4, languages, about, availability', () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  assert.equal(m.family, 'editing_video');
  assert.deepEqual(sectionKeys(m), ['about', 'skills', 'projects', 'experience', 'extracurriculars', 'education', 'achievements', 'hobbies', 'languages']);
  assert.deepEqual(m.header.links.map((l) => l.label), ['LinkedIn', 'Portfolio']);
  assert.equal(section(m, 'education').items[0].heading, 'B.Tech ECE, XYZ Institute, expected 2029');
  assert.equal(section(m, 'hobbies').items[0].lines[0].text, 'Cooking (regional recipes), Chess, Cycling, Reading');
  assert.equal(section(m, 'languages').items[0].lines[0].text, 'English (Fluent), Hindi (Native)');
  assert.equal(section(m, 'about').items[0].lines[0].src.id, 'about');
  assert.ok(m.header.contactLine.some((c) => c.src.type === 'work'), 'availability printed because the posting asks for hours');
  assert.ok(m.header.contactLine.every((c) => c.text && c.src));
  // Result lines: unconfirmed number -> not printed; confirmed via evidence -> printed; no digits -> printed
  const e1 = section(m, 'projects').items.find((i) => i.id === 'e1');
  assert.ok(!e1.lines.some((l) => /15,000/.test(l.text)));
  const e3 = section(m, 'projects').items.find((i) => i.id === 'e3');
  assert.ok(e3.lines.some((l) => /under 1 second/.test(l.text)));
  const e2 = section(m, 'experience').items[0];
  assert.ok(e2.lines.some((l) => l.text === 'Club page followers grew'));
  assert.equal(e2.dateRange, 'Aug 2024 - Present');
  assert.ok(allLines(m).every((l) => l.src && l.src.type && l.src.id));
});

test('bullet edits, link overrides, number confirmation on entry, secondary family link', () => {
  const p = makeProfile();
  const s = makeSession();
  s.bulletEdits = { b2: 'Graded all footage to one warm look' };
  s.linkOverrides = { linkedin: false, github: true, portfolio: null };
  s.numberConfirmations = { e1: { confirmed: true, sourceNote: 'Instagram insights' } };
  const m = buildResume(p, s);
  const e1 = section(m, 'projects').items.find((i) => i.id === 'e1');
  assert.equal(e1.lines.find((l) => l.id === 'b2').text, 'Graded all footage to one warm look');
  assert.equal(e1.lines.find((l) => l.id === 'b2').src.id, 'b2', 'edited bullet still traces to its id');
  assert.ok(e1.lines.some((l) => /15,000/.test(l.text)), 'result prints once the entry number is confirmed');
  assert.deepEqual(m.header.links.map((l) => l.label), ['GitHub', 'Portfolio']);

  const s2 = makeSession({ title: 'Operations intern', jdText: 'Operations intern needed. Requirements:\n- Coordinate vendors and volunteers for events' });
  s2.family = { primary: 'operations_events', secondary: 'software_web' };
  const m2 = buildResume(p, s2);
  assert.deepEqual(m2.header.links.map((l) => l.label), ['LinkedIn', 'GitHub'], 'secondary family may add its link');
  assert.equal(sectionKeys(m2)[1], 'experience');
});

test('general family: education first, cgpa shown under relevant, warnings for empty selection and sparse profile', () => {
  const p = makeProfile();
  const s = makeSession({ title: 'Campus ambassador', jdText: 'Campus ambassador needed to talk to students about our app. Must be enthusiastic and reliable, 10 hours a week.' });
  assert.equal(s.family.primary, 'general');
  s.selection = { entryIds: [], achievementIds: [], extracurricularIds: [], hobbyIds: [], includeAboutMe: false, aboutMeText: '' };
  const m = buildResume(p, s);
  assert.equal(sectionKeys(m)[0], 'education');
  assert.ok(section(m, 'education').items[0].lines.some((l) => l.text === 'CGPA: 8.4' && l.src.type === 'marks'));
  assert.ok(!section(m, 'experience') && !section(m, 'projects') && !section(m, 'about') && !section(m, 'hobbies'));
  assert.ok(m.warnings.some((w) => /No experience or projects selected/.test(w)));
  assert.equal(m.warnings.filter((w) => /No experience or projects selected/.test(w)).length, 1);

  const sparse = makeProfile();
  sparse.entries = [];
  sparse.extracurriculars = [];
  sparse.achievements = [{ id: 'a1', name: 'x', date: '', detail: '' }];
  const sm = buildResume(sparse, s);
  assert.ok(sm.warnings.some((w) => /Sparse profile/.test(w)));
});

test('overlay skills and confirmations change what prints without touching the profile', () => {
  const p = makeProfile();
  const s = makeSession();
  s.overlay.skills = [{ id: 'ov1', name: 'Premiere Pro', category: 'tool', level: 'have', whereUsed: 'Cut a friend\'s wedding video', exposureNote: '' }];
  const python = p.skills.find((x) => x.name === 'Python');
  s.confirmations = [{ reqId: 'req-x', skillId: python.id, level: 'have', whereUsed: 'Batch renamed clips with a script', aiAssisted: true, saveToProfile: false }];
  const m = buildResume(p, s);
  assert.match(lineText(m, 'skills-have'), /Premiere Pro/);
  assert.equal(lineText(m, 'skills-ai'), 'AI-assisted: JavaScript, Python');
  assert.equal(lineText(m, 'skills-exposure'), undefined);
  assert.equal(python.level, 'exposure', 'profile untouched');
  assert.equal(checkIntegrity(m, p, s).ok, true);
});

test('buildResume is deterministic', () => {
  const p = makeProfile();
  const s = makeSession();
  assert.deepEqual(buildResume(p, s), buildResume(p, s));
});
