import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFileName } from '../core/filename.js';
import { validateReword, validateAiExtraction } from '../core/ai-guard.js';
import { snapshotHash, stableStringify } from '../core/hash.js';
import { newProfile, migrateProfile, validateProfile, newId } from '../core/schema.js';
import { buildResume } from '../core/tailor.js';
import { buildMatchSummary } from '../core/match.js';
import { VERBS, SKILL_CATALOG, FAMILIES, TEMPLATES, SOURCES, BANNED_LEVEL_WORDS } from '../core/data.js';
import { makeProfile, makeSession, VIDEO_JD } from './_fixtures.js';

test('resumeFileName is ascii-safe, hyphenated, with fallback', () => {
  const p = makeProfile();
  const s = makeSession();
  assert.equal(resumeFileName(p, s), 'Asha-Rao-Acme-Studios-Video-Editor-Intern.pdf');
  p.basics.fullName = 'Zoë  D\'Souza';
  s.role.company = 'Café & Co. (Pvt) Ltd';
  s.role.title = 'UI/UX Intern — 2026';
  assert.equal(resumeFileName(p, s), 'Zoe-D-Souza-Cafe-Co-Pvt-Ltd-UI-UX-Intern-2026.pdf');
  assert.equal(resumeFileName({}, {}), 'Resume.pdf');
  assert.equal(resumeFileName({ basics: { fullName: 'Ravi' } }, { role: { company: '', title: '' } }), 'Ravi.pdf');
});

test('validateReword accepts honest rewrites and rejects every forbidden change', () => {
  const original = 'Edited 12 short reels in DaVinci Resolve for the fest page';
  const good = validateReword(original, 'Edited 12 short fest reels in DaVinci Resolve', { confirmedSkills: ['DaVinci Resolve'] });
  assert.deepEqual(good, { ok: true, text: 'Edited 12 short fest reels in DaVinci Resolve', reasons: [] });

  const cases = [
    ['Edited 15 short reels in DaVinci Resolve', /number/],
    ['Edited 12 reels in DaVinci Resolve as an expert', /banned/i],
    ['Edited 12 reels in DaVinci Resolve and Premiere Pro', /Premiere Pro/],
    ['Reels edited in DaVinci Resolve', /action verb/],
    [`Edited 12 reels in DaVinci Resolve ${'with great care '.repeat(6)}`, /110/],
    ['Edited 12 reels in DaVinci Resolve for my fest page', /pronoun/],
    ['', /empty/i],
  ];
  for (const [reworded, reason] of cases) {
    const r = validateReword(original, reworded, { confirmedSkills: ['DaVinci Resolve'] });
    assert.equal(r.ok, false, reworded);
    assert.equal(r.text, original);
    assert.ok(r.reasons.some((x) => reason.test(x)), `${reworded} -> ${r.reasons.join('; ')}`);
  }
  // A confirmed skill may be introduced; "Premiere" alias resolves to the confirmed canonical name
  const ok2 = validateReword(original, 'Edited 12 reels in Premiere and DaVinci Resolve', { confirmedSkills: ['Premiere Pro', 'DaVinci Resolve'] });
  assert.equal(ok2.ok, true);
  // Years are not "new numbers" when already present; a new year is
  assert.equal(validateReword('Launched the club site in 2025', 'Launched the club site in 2025').ok, true);
  assert.equal(validateReword('Launched the club site', 'Launched the club site in 2025').ok, false);
});

test('validateAiExtraction coerces and drops ungrounded requirements', () => {
  const raw = {
    requirements: [
      { text: 'Strong hands-on experience with DaVinci Resolve', canonicalSkill: 'davinci', priority: 'must' },
      { text: 'Kubernetes cluster administration', canonicalSkill: 'Docker', priority: 'must' },
      { text: 'Fluent in Spanish', canonicalSkill: null, priority: 'weird' },
      { text: 'Canva for thumbnails', canonicalSkill: 'Canva' },
      'junk',
    ],
    workMode: 'onsite',
    location: 'Bengaluru',
    educationMentioned: { degree: 'yes' },
    linksRequested: { portfolio: true },
    feeWarning: 'no',
    unreadable: ['x', 5],
    suggestedFamily: { primary: 'editing_video', secondary: 'editing_video', reason: 'AI said so' },
  };
  const ex = validateAiExtraction(raw, VIDEO_JD);
  assert.deepEqual(ex.requirements.map((r) => [r.canonicalSkill, r.priority]), [['DaVinci Resolve', 'must'], ['Canva', 'unknown']]);
  assert.deepEqual(ex.requirements.map((r) => r.id), ['req-1', 'req-2']);
  assert.equal(ex.workMode, null);
  assert.equal(ex.location, 'Bengaluru');
  assert.deepEqual(ex.educationMentioned, { degree: false, year: false, cgpa: false, coursework: false });
  assert.deepEqual(ex.linksRequested, { github: false, portfolio: true, linkedin: false });
  assert.equal(ex.feeWarning, false);
  assert.deepEqual(ex.unreadable, ['x']);
  assert.deepEqual(ex.suggestedFamily, { primary: 'editing_video', secondary: null, reason: 'AI said so' });
  assert.equal(ex.designToolsMentioned, true);
  assert.equal(validateAiExtraction('nope', VIDEO_JD), null);
  assert.equal(validateAiExtraction({ suggestedFamily: { primary: 'astronaut' } }, VIDEO_JD).suggestedFamily.primary, 'editing_video');
  const many = validateAiExtraction({ requirements: Array.from({ length: 60 }, () => ({ text: 'Colour grading', canonicalSkill: null })) }, VIDEO_JD);
  assert.equal(many.requirements.length, 40);
});

test('snapshotHash is deterministic, key-order independent and edit-sensitive', async () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  const a = await snapshotHash(m, s.template);
  const b = await snapshotHash(JSON.parse(JSON.stringify(m)), { ...s.template });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] }), '{"a":[{"c":2,"d":1}],"b":1}');
  const reordered = { ...m, header: { ...m.header, name: m.header.name } };
  assert.equal(await snapshotHash(reordered, s.template), a);
  const edited = structuredClone(m);
  edited.sections[0].items[0].lines[0].text += '.';
  assert.notEqual(await snapshotHash(edited, s.template), a);
  assert.notEqual(await snapshotHash(m, { ...s.template, id: 'two_column' }), a);
});

test('schema: newProfile defaults, migrateProfile fills gaps, validateProfile reports problems', () => {
  const p = newProfile();
  assert.ok(p.skills.length >= 10 && p.skills.every((s) => s.level === null && s.id));
  assert.deepEqual(p.languages.map((l) => [l.name, l.level]), [['English', null], ['Hindi', null]]);
  assert.equal(p.marks.cgpa.display, 'relevant');
  assert.equal(p.settings.pageSize, 'A4');
  assert.match(newId(), /^[0-9a-f-]{36}$/);

  const old = { basics: { fullName: 'R', email: 'r@x.io' }, skills: [{ name: 'Figma', level: 'pro' }], entries: [{ title: 'T', bullets: ['a', 'b'] }], marks: { cgpa: { value: '9' } } };
  const m = migrateProfile(old);
  assert.equal(m.version, 1);
  assert.equal(m.skills[0].level, null, 'invalid level is reset to null');
  assert.ok(m.skills[0].id && m.entries[0].id && m.entries[0].bullets[0].id);
  assert.equal(m.entries[0].kind, 'project');
  assert.equal(m.entries[0].result.numberStatus, 'unconfirmed');
  assert.equal(m.marks.cgpa.display, 'relevant');
  assert.equal(m.marks.twelfth.value, null);
  assert.equal(validateProfile(m).ok, true, validateProfile(m).errors.join('; '));

  const bad = makeProfile();
  bad.basics.email = 'not-an-email';
  bad.skills[0].level = 'have';
  bad.skills[0].whereUsed = '';
  bad.entries[0].bullets = [{ id: 'z', text: 'only one' }];
  const v = validateProfile(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /email/.test(e)));
  assert.ok(v.errors.some((e) => /Where I used it/.test(e)));
  assert.ok(v.errors.some((e) => /2-4 bullets/.test(e)));
  // The fixture deliberately has CSS at "have" without a "Where I used it" note; that is its only problem
  const fixture = validateProfile(makeProfile());
  assert.equal(fixture.ok, false);
  assert.deepEqual(fixture.errors.map((e) => /'CSS'/.test(e)), [true]);
});

test('buildMatchSummary: met / partial / not_met, verification flags, interview prep, sparse', () => {
  const p = makeProfile();
  const s = makeSession({ source: 'telgram_whatsapp' });
  s.role.source = 'telegram_whatsapp';
  s.companyCheck.status = 'could_not_confirm';
  const python = p.skills.find((x) => x.name === 'Python');
  s.extraction.requirements.push({ id: 'req-py', text: 'Python scripting', canonicalSkill: 'Python', priority: 'nice' });
  s.extraction.requirements.push({ id: 'req-cam', text: 'camera operator', canonicalSkill: null, priority: 'nice' });
  const m = buildResume(p, s);
  const sum = buildMatchSummary(p, s, m);
  const status = (name) => sum.requirements.find((r) => r.canonicalSkill === name);
  assert.equal(status('DaVinci Resolve').status, 'met');
  assert.equal(status('DaVinci Resolve').via, 'DaVinci Resolve');
  assert.equal(status('Canva').status, 'met');
  assert.equal(status('Python').status, 'partial');
  assert.equal(status('Premiere Pro').status, 'not_met');
  assert.equal(status('After Effects').status, 'not_met');
  assert.equal(sum.requirements.find((r) => r.id === 'req-cam').via, 'bullet');
  assert.equal(python.level, 'exposure');
  assert.match(sum.workModeFit, /remote/);
  assert.equal(sum.verification.companyCheck, 'could_not_confirm');
  assert.equal(sum.verification.sourceUnverified, true);
  assert.equal(sum.verification.feeWarning, false);
  assert.match(sum.verification.caution, /Never pay a fee/);
  assert.ok(sum.interviewPrep.some((l) => /AI-assisted skills \(JavaScript\)/.test(l)));
  assert.ok(sum.interviewPrep.some((l) => /Exposure-level skills \(Python\)/.test(l)));
  assert.ok(sum.interviewPrep.some((l) => /Number in "Edited 12/.test(l)));
  assert.ok(sum.interviewPrep.some((l) => /Hobbies/.test(l)));
  assert.equal(sum.sparse, false);
  assert.ok(sum.missing.length >= 2);
});

test('data invariants', () => {
  assert.ok(VERBS.flat.length >= 60);
  assert.ok(VERBS.set.has('coordinated') && VERBS.set.has('built'));
  assert.ok(SKILL_CATALOG.length >= 40);
  assert.ok(SKILL_CATALOG.find((s) => s.name === 'JavaScript').aliases.includes('js'));
  assert.ok(SKILL_CATALOG.find((s) => s.name === 'Figma').designTool);
  assert.equal(new Set(SKILL_CATALOG.map((s) => s.name.toLowerCase())).size, SKILL_CATALOG.length);
  assert.equal(FAMILIES.length, 6);
  assert.ok(FAMILIES.every((f) => f.order.length === 9 && ['compact', 'normal', 'prominent'].includes(f.education)));
  assert.equal(TEMPLATES.filter((t) => t.recommended).length, 1);
  assert.ok(TEMPLATES.filter((t) => !t.recommended).every((t) => t.useWithCare));
  assert.deepEqual(SOURCES.filter((s) => s.unverified).map((s) => s.id), ['telegram_whatsapp', 'email_dm']);
  assert.ok(BANNED_LEVEL_WORDS.includes('proficient') && BANNED_LEVEL_WORDS.includes('highly skilled'));
});
