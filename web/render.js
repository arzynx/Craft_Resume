// Renders a ResumeModel (core/tailor.js) into DOM for preview, fit measurement and print.
// Every line carries data-line-id and data-src-type / data-src-id. No ratings, bars or stars, ever.
import { h } from './ui.js';

const SIDEBAR_KEYS = new Set(['skills', 'languages', 'hobbies']);
const INLINE_KEYS = new Set(['skills', 'languages', 'hobbies', 'about']);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM' -> 'Jan 2025'; 'present' -> 'Present'. */
export function formatMonth(ym) {
  if (!ym) return '';
  if (String(ym).toLowerCase() === 'present') return 'Present';
  const m = /^(\d{4})-(\d{2})/.exec(String(ym));
  if (!m) return String(ym);
  return `${MONTHS[Math.max(0, Math.min(11, Number(m[2]) - 1))]} ${m[1]}`;
}
/** "Jan 2025 - Present" */
export function formatDateRange(start, end) {
  const a = formatMonth(start); const b = formatMonth(end);
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

function srcAttrs(src, lineId) {
  const d = {};
  if (lineId != null) d.lineId = String(lineId);
  if (src) { if (src.type) d.srcType = String(src.type); if (src.id != null) d.srcId = String(src.id); }
  return d;
}

function renderHeader(header, templateId, pageSizeTitle) {
  const withPhoto = templateId === 'two_column_photo' && header.photoDataUrl;
  const text = h('div', { class: 'r-head-text' });
  text.append(h('h1', { dataset: srcAttrs({ type: 'basics', id: 'fullName' }, 'header-name') }, header.name || ''));
  if (Array.isArray(header.contactLine) && header.contactLine.length) {
    text.append(h('p', { class: 'r-contact' }, header.contactLine.map((c, i) =>
      h('span', { dataset: srcAttrs(c.src, c.id ?? `contact-${i}`) }, c.text))));
  }
  if (Array.isArray(header.links) && header.links.length) {
    text.append(h('p', { class: 'r-links' }, header.links.map((l, i) =>
      h('span', { dataset: srcAttrs(l.src, l.id ?? `link-${i}`) }, l.url ? h('a', { href: l.url }, l.label ? `${l.label}: ${l.url}` : l.url) : l.label))));
  }
  const head = h('header', { class: 'r-header' + (withPhoto ? ' with-photo' : '') });
  if (withPhoto) head.append(h('img', { class: 'r-photo', src: header.photoDataUrl, alt: '' }));
  head.append(text);
  return head;
}

function renderItem(item, sectionKey) {
  const inline = INLINE_KEYS.has(sectionKey) || (!item.heading && !item.dateRange && !item.sub);
  const lines = Array.isArray(item.lines) ? item.lines : [];
  if (inline) {
    const p = h('p', { class: 'r-inline', dataset: srcAttrs(item.src, item.id) });
    if (item.heading) p.append(h('span', { class: 'r-label' }, item.heading + ': '));
    for (const l of lines) p.append(h('span', { class: 'r-text', dataset: srcAttrs(l.src, l.id) }, l.text));
    return p;
  }
  const el = h('div', { class: 'r-item', dataset: srcAttrs(item.src, item.id) });
  el.append(h('div', { class: 'r-item-head' },
    h('span', { class: 'r-heading' }, item.heading || ''),
    item.dateRange ? h('span', { class: 'r-date' }, item.dateRange) : null));
  if (item.sub) el.append(h('div', { class: 'r-sub' }, item.sub));
  if (lines.length) el.append(h('ul', null, lines.map((l) => h('li', { dataset: srcAttrs(l.src, l.id) }, l.text))));
  return el;
}

function renderSection(section) {
  const items = Array.isArray(section.items) ? section.items : [];
  if (!items.length) return null;
  return h('section', { class: 'r-section r-section-' + section.key, dataset: { key: section.key } },
    h('h2', null, section.title || section.key),
    items.map((it) => renderItem(it, section.key)));
}

/**
 * renderResume(model, templateId, pageSize) -> HTMLElement (.resume)
 * DOM order: header, main, aside (aside only for two-column templates).
 */
export function renderResume(model, templateId = 'text_first', pageSize = 'A4') {
  const tpl = ['text_first', 'text_accent', 'two_column', 'two_column_photo'].includes(templateId) ? templateId : 'text_first';
  const size = pageSize === 'Letter' ? 'Letter' : 'A4';
  const root = h('article', { class: `resume tpl-${tpl} page-${size}`, dataset: { template: tpl, page: size }, lang: 'en' });
  root.append(renderHeader(model.header || {}, tpl));
  const twoCol = tpl === 'two_column' || tpl === 'two_column_photo';
  const main = h('div', { class: 'r-main' });
  const aside = twoCol ? h('aside', { class: 'r-aside' }) : null;
  for (const s of model.sections || []) {
    const el = renderSection(s);
    if (!el) continue;
    if (twoCol && SIDEBAR_KEYS.has(s.key)) aside.append(el); else main.append(el);
  }
  root.append(main);
  if (aside && aside.childElementCount) root.append(aside);
  return root;
}

/** Update the print @page size to match the chosen page size. */
export function setPrintPageSize(pageSize) {
  const style = document.getElementById('print-page-size');
  if (style) style.textContent = `@page { size: ${pageSize === 'Letter' ? 'Letter' : 'A4'}; margin: 0; }`;
}

/** Render into #print-root and open the print dialog. Only call after approval. */
export function printModel(model, templateId, pageSize, title) {
  const root = document.getElementById('print-root');
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);
  root.append(renderResume(model, templateId, pageSize));
  setPrintPageSize(pageSize);
  const prevTitle = document.title;
  if (title) document.title = title.replace(/\.pdf$/i, '');
  const done = () => { document.title = prevTitle; window.removeEventListener("afterprint", done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
