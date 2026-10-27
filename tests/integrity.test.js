import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResume } from '../core/tailor.js';
import { checkIntegrity } from '../core/integrity.js';
import { makeProfile, makeSession, section } from './_fixtures.js';

const codes = (r) => r.violations.map((v) => v.code);
const has = (r, code, lineId) => r.violations.some((v) => v.code === code && (lineId == null || v.lineId === lineId));

test('clean build passes with only verb warnings allowed', () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  const r = checkIntegrity(m, p, s);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.ok(r.violations.every((v) => v.severity === 'warn'));
});

test('NO_SOURCE: a line or header item without a resolvable source blocks', () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  section(m, 'experience').items[0].lines.push({ id: 'ghost', text: 'Led a team of editors', src: { type: 'bullet', id: 'nope' } });
  m.header.contactLine.push({ text: 'Mumbai', src: { type: 'basics', id: 'address' } });
  m.header.links.push({ label: 'Behance', url: 'https://behance.net/x', src: { type: 'link', id: 'behance' } });
  section(m, 'hobbies').items[0].lines[0].srcs.push('h-missing');
  const r = checkIntegrity(m, p, s);
  assert.equal(r.ok, false);
  assert.ok(has(r, 'NO_SOURCE', 'ghost'));
  assert.ok(has(r, 'NO_SOURCE', 'header:address'));
  assert.ok(has(r, 'NO_SOURCE', 'link:behance'));
  assert.ok(has(r, 'NO_SOURCE', 'hobbies-line'));
  assert.ok(r.violations.filter((v) => v.code === 'NO_SOURCE').every((v) => v.severity === 'block'));
});

test('UNCONFIRMED_NUMBER: digits without evidence block; dates and confirmed numbers pass', () => {
  const p = makeProfile();
  const s = makeSession();
  s.numberConfirmations = {};
  p.entries[1].bullets[0].text = 'Filmed 3 campus events as camera operator';
  p.entries[1].bullets[1].text = 'Coordinated the Jan 2025 shoot and the 2024-11 recap';
  const m = buildResume(p, s);
  let r = checkIntegrity(m, p, s);
  assert.ok(has(r, 'UNCONFIRMED_NUMBER', 'b1'), 'b1 has 12 and no confirmation now');
  assert.ok(has(r, 'UNCONFIRMED_NUMBER', 'b4'));
  assert.ok(!has(r, 'UNCONFIRMED_NUMBER', 'b5'), 'dates are not numbers');
  assert.ok(!has(r, 'UNCONFIRMED_NUMBER', 'e3-result'), 'evidence-backed entry passes');

  s.numberConfirmations = { b4: { confirmed: true, sourceNote: 'event list' }, e1: { confirmed: true, sourceNote: 'counted' } };
  r = checkIntegrity(buildResume(p, s), p, s);
  assert.ok(!has(r, 'UNCONFIRMED_NUMBER', 'b4'));
  assert.ok(!has(r, 'UNCONFIRMED_NUMBER', 'b1'), 'entry-level confirmation covers its bullets');
  assert.ok(!has(r, 'UNCONFIRMED_NUMBER', 'e1-result'));
});

test('EXPOSURE_IN_BULLET: exposure skill name inside a bullet blocks', () => {
  const p = makeProfile();
  const s = makeSession();
  p.entries[0].bullets[1].text = 'Wrote a Python script to rename clips';
  const m = buildResume(p, s);
  const r = checkIntegrity(m, p, s);
  assert.ok(has(r, 'EXPOSURE_IN_BULLET', 'b2'));
  assert.equal(r.ok, false);
  // "pythonic" is not the word "Python"
  p.entries[0].bullets[1].text = 'Wrote pythonic-looking pseudo code';
  assert.ok(!has(checkIntegrity(buildResume(p, s), p, s), 'EXPOSURE_IN_BULLET'));
});

test('BANNED_WORD: in the skills section, or next to an AI-assisted / exposure skill', () => {
  const p = makeProfile();
  const s = makeSession();
  s.overlay.skills = [{ id: 'ov1', name: 'Advanced Excel', category: 'tool', level: 'have', whereUsed: 'Fest budget sheet', exposureNote: '' }];
  p.entries[0].bullets[1].text = 'Built an expert-level JavaScript carousel';
  p.entries[0].bullets[2].text = 'Designed advanced title cards in Canva';
  const m = buildResume(p, s);
  const r = checkIntegrity(m, p, s);
  assert.ok(has(r, 'BANNED_WORD', 'skills-have'));
  assert.ok(has(r, 'BANNED_WORD', 'b2'), 'expert next to AI-assisted JavaScript');
  assert.ok(!has(r, 'BANNED_WORD', 'b3'), 'banned word away from any labelled skill is allowed in a bullet');
});

test('UNCONFIRMED_SKILL and RATING_GRAPHIC on tampered models', () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  const css = p.skills.find((x) => x.name === 'CSS');
  const cpp = p.skills.find((x) => x.name === 'C/C++');
  const line = section(m, 'skills').items[0].lines[0];
  line.text += ', CSS, C/C++';
  line.srcs.push(css.id, cpp.id);
  const r = checkIntegrity(m, p, s);
  assert.equal(r.violations.filter((v) => v.code === 'UNCONFIRMED_SKILL').length, 2);

  const m2 = buildResume(p, s);
  section(m2, 'skills').items[0].lines[0].text += ' ★★★★☆';
  section(m2, 'projects').items[0].lines[0].text = 'Edited 12 reels, DaVinci Resolve 90%';
  const r2 = checkIntegrity(m2, p, s);
  assert.ok(has(r2, 'RATING_GRAPHIC', 'skills-have'));
  assert.ok(has(r2, 'RATING_GRAPHIC', 'b1'));
  assert.equal(r2.ok, false);
});

test('MISSING_VERB is a warning and does not fail ok', () => {
  const p = makeProfile();
  const s = makeSession();
  p.entries[0].bullets[1].text = 'Footage was graded warm';
  const r = checkIntegrity(buildResume(p, s), p, s);
  const v = r.violations.find((x) => x.code === 'MISSING_VERB' && x.lineId === 'b2');
  assert.ok(v);
  assert.equal(v.severity, 'warn');
  assert.equal(r.ok, true);
  assert.ok(codes(r).every((c) => c === 'MISSING_VERB'));
});
