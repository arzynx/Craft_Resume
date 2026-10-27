import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromText, suggestFamily } from '../core/extract.js';
import { VIDEO_JD, FRONTEND_JD } from './_fixtures.js';

const byCanonical = (ex, name) => ex.requirements.find((r) => r.canonicalSkill === name);

test('video editor JD: family, design tools, links, must/nice, facts', () => {
  const ex = extractFromText({ title: 'Video Editor Intern', jdText: VIDEO_JD });
  assert.equal(ex.suggestedFamily.primary, 'editing_video');
  assert.match(ex.suggestedFamily.reason, /video editor/i);
  assert.equal(ex.designToolsMentioned, true);
  assert.deepEqual(ex.linksRequested, { github: false, portfolio: true, linkedin: true });
  assert.equal(byCanonical(ex, 'DaVinci Resolve').priority, 'must');
  assert.equal(byCanonical(ex, 'Premiere Pro').priority, 'must');
  assert.equal(byCanonical(ex, 'Colour grading').priority, 'must');
  assert.equal(byCanonical(ex, 'After Effects').priority, 'nice');
  assert.equal(byCanonical(ex, 'Canva').priority, 'nice');
  assert.equal(ex.workMode, 'remote');
  assert.equal(ex.location, 'Bengaluru');
  assert.equal(ex.duration, '3 months');
  assert.match(ex.stipend, /8,000/);
  assert.equal(ex.availabilityAsked, true);
  assert.equal(ex.feeWarning, false);
  assert.deepEqual(ex.unreadable, []);
  // Unmatched requirement bullets keep canonicalSkill null and as-written text
  const unmatched = ex.requirements.filter((r) => r.canonicalSkill === null);
  assert.ok(unmatched.some((r) => /showreel link/i.test(r.text)));
  assert.ok(unmatched.every((r) => r.canonicalSkill === null && r.text.length > 0));
  assert.ok(!unmatched.some((r) => /^apply by/i.test(r.text)), 'how-to-apply lines are not requirements');
  // One requirement per matched skill
  const names = ex.requirements.map((r) => r.canonicalSkill).filter(Boolean);
  assert.equal(new Set(names).size, names.length);
  assert.ok(ex.requirements.every((r) => /^req-\d+$/.test(r.id)));
});

test('frontend JD: software family, github requested, hybrid, education mentioned, must/nice', () => {
  const ex = extractFromText({ title: 'Frontend Developer Intern', jdText: FRONTEND_JD });
  assert.equal(ex.suggestedFamily.primary, 'software_web');
  assert.equal(ex.linksRequested.github, true);
  assert.equal(ex.workMode, 'hybrid');
  assert.equal(ex.designToolsMentioned, true, 'Figma is mentioned as nice-to-have');
  assert.equal(ex.educationMentioned.degree, true);
  assert.equal(ex.educationMentioned.year, true);
  assert.equal(ex.educationMentioned.cgpa, false);
  assert.equal(byCanonical(ex, 'JavaScript').priority, 'must');
  assert.equal(byCanonical(ex, 'React').priority, 'must');
  assert.equal(byCanonical(ex, 'Git/GitHub').priority, 'must');
  assert.equal(byCanonical(ex, 'TypeScript').priority, 'nice');
  assert.equal(byCanonical(ex, 'Figma').priority, 'nice');
  assert.equal(ex.duration, '6-month');
  assert.match(ex.stipend, /15,000/);
  assert.equal(ex.location, 'Bengaluru');
});

test('aliases match with word boundaries and case-insensitively', () => {
  const ex = extractFromText({ title: 'Intern', jdText: 'Requirements:\n- Comfortable with JS and ES6\n- davinci experience\n- Knows node and postgres' });
  assert.ok(byCanonical(ex, 'JavaScript'));
  assert.ok(byCanonical(ex, 'DaVinci Resolve'));
  assert.ok(byCanonical(ex, 'Node.js'));
  assert.ok(byCanonical(ex, 'SQL'));
  const none = extractFromText({ title: 'Intern', jdText: 'Requirements:\n- Adjust the lens and resolve customer issues within the sales pipeline, no jsx needed' });
  assert.equal(byCanonical(none, 'JavaScript'), undefined, '"jsx" must not match the "js" alias');
});

test('fee warning, unverified cues and short-text note', () => {
  const fee = extractFromText({ title: 'Data entry', jdText: 'Work from home data entry job. Pay a registration fee of Rs 500 to get the kit. Earn 20000 per month guaranteed. Contact on WhatsApp.' });
  assert.equal(fee.feeWarning, true);
  assert.equal(fee.workMode, 'remote');
  const short = extractFromText({ title: 'Editor', jdText: 'Need a reels editor.' });
  assert.equal(short.unreadable.length, 1);
  assert.equal(short.suggestedFamily.primary, 'editing_video');
});

test('suggestFamily: title weighs x3, secondary only when close and >= 2', () => {
  const r = suggestFamily('Social media designer and content writer', 'Create posters in Canva and Figma, write captions and blog posts, manage the content calendar.');
  assert.equal(r.primary, 'content_writing', 'title hits "content writer", "writer" and "content" (x3 each)');
  assert.equal(r.secondary, 'design');
  assert.match(r.reason, /Design also scored well/);
  const d = suggestFamily('Graphic designer', 'Make posters and thumbnails in Figma and Canva; write short captions.');
  assert.equal(d.primary, 'design');
  const g = suggestFamily('Campus ambassador', 'Represent us on campus and talk to students.');
  assert.equal(g.primary, 'general');
  assert.equal(g.secondary, null);
  const solo = suggestFamily('Video editor', 'Edit reels in Premiere.');
  assert.equal(solo.primary, 'editing_video');
  assert.equal(solo.secondary, null);
});
