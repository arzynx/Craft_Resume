import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResume } from '../core/tailor.js';
import { applyNextTrim, estimateLines, fitToOnePage, TRIM_ORDER, PAGE_LINE_BUDGET } from '../core/fit.js';
import { makeProfile, makeSession, section, sectionKeys } from './_fixtures.js';

test('trim order follows SPEC 13.1 and never mutates the input model', () => {
  const p = makeProfile();
  const s = makeSession();
  const model = buildResume(p, s);
  const frozen = JSON.stringify(model);
  assert.deepEqual(TRIM_ORDER, ['hobbies', 'languages', 'extracurricular_item', 'entry_bullets', 'about']);

  const kinds = [];
  let m = model;
  for (;;) {
    const { model: next, trim } = applyNextTrim(m);
    if (!trim) break;
    kinds.push(trim.kind);
    assert.equal(trim.step, kinds.length);
    assert.ok(trim.what && trim.reason);
    assert.equal(next.trims.length, kinds.length);
    m = next;
  }
  assert.equal(JSON.stringify(model), frozen, 'input model untouched');
  assert.deepEqual(kinds, [
    'hobbies',
    'languages',
    'extracurricular_item', // Photography club (last)
    'extracurricular_item', // NSS volunteer
    'entry_bullets', // Portfolio Site has 2 bullets -> skipped; Media Team Volunteer bullet 4
    'entry_bullets', // Media Team Volunteer bullet 3
    'entry_bullets', // Fest Reels bullet 3
    'about',
  ]);
  assert.ok(!section(m, 'hobbies') && !section(m, 'languages') && !section(m, 'extracurriculars') && !section(m, 'about'));
  for (const key of ['experience', 'projects']) {
    for (const item of section(m, key).items) {
      assert.ok(item.lines.filter((l) => l.src.type === 'bullet').length <= 2);
    }
  }
  assert.equal(applyNextTrim(m).trim, null);
});

test('bullets are trimmed from the last entry backwards and result lines are kept', () => {
  const p = makeProfile();
  const s = makeSession();
  let m = buildResume(p, s);
  // skip hobbies, languages, two extracurriculars
  for (let i = 0; i < 4; i += 1) m = applyNextTrim(m).model;
  const { model: next, trim } = applyNextTrim(m);
  assert.equal(trim.kind, 'entry_bullets');
  assert.equal(trim.lineId, 'b7', 'experience is after projects for editing_video, so its 4th bullet goes first');
  const e2 = section(next, 'experience').items[0];
  assert.ok(e2.lines.some((l) => l.kind === 'result'));
  assert.deepEqual(sectionKeys(next), ['about', 'skills', 'projects', 'experience', 'education', 'achievements']);
});

test('estimateLines and fitToOnePage', () => {
  const p = makeProfile();
  const s = makeSession();
  const m = buildResume(p, s);
  const n = estimateLines(m);
  assert.ok(n > 10 && n < PAGE_LINE_BUDGET.A4, `estimate ${n}`);
  assert.equal(fitToOnePage(m).trims.length, 0);

  // Make it overflow: pad bullets with long text
  const big = structuredClone(m);
  for (const sec of big.sections) for (const it of sec.items) for (const l of it.lines) l.text = `${l.text} ${'lorem ipsum '.repeat(30)}`;
  assert.ok(estimateLines(big) > PAGE_LINE_BUDGET.A4);
  const fitted = fitToOnePage(big);
  assert.ok(fitted.trims.length > 0);
  assert.equal(fitted.trims[0].kind, 'hobbies');
  assert.equal(fitted.model.trims.length, fitted.trims.length);
  assert.equal(PAGE_LINE_BUDGET.Letter, 50);
});
