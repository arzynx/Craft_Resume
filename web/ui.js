// Tiny DOM helpers. No framework, no templates: everything is built with h().
import { helperFor, HOBBY_EXAMPLES } from './catalog.js';

/** h('div', { class: 'x', onclick: fn, dataset: {...}, 'aria-label': 'y' }, ...children) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (['value', 'checked', 'disabled', 'selected', 'open', 'readOnly', 'indeterminate', 'textContent'].includes(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let uid = 0;
export function nextId(prefix = 'f') { return `${prefix}-${++uid}`; }

/** Labelled form field. */
export function field(label, input, { hint, error, id, required } = {}) {
  const fid = id || input.id || nextId('fld');
  if (!input.id) input.id = fid;
  const wrap = h('div', { class: 'field' + (error ? ' has-error' : '') },
    h('label', { class: 'label', for: fid }, label, required ? h('span', { class: 'muted', 'aria-hidden': 'true' }, ' *') : null),
    input,
    hint ? h('span', { class: 'hint', id: fid + '-hint' }, hint) : null,
    error ? h('span', { class: 'error', id: fid + '-err', role: 'alert' }, error) : null);
  if (hint) input.setAttribute('aria-describedby', fid + '-hint');
  if (required) input.setAttribute('aria-required', 'true');
  wrap.setError = (msg) => {
    let e = wrap.querySelector('.error');
    if (!msg) { if (e) e.remove(); wrap.classList.remove('has-error'); input.removeAttribute('aria-invalid'); return; }
    if (!e) { e = h('span', { class: 'error', role: 'alert' }); wrap.append(e); }
    e.textContent = msg; wrap.classList.add('has-error'); input.setAttribute('aria-invalid', 'true');
  };
  return wrap;
}

/** Text input bound to obj[key]; calls onInput after each change. */
export function bindInput(obj, key, { type = 'text', placeholder = '', onInput, textarea = false, attrs = {} } = {}) {
  const el = textarea ? h('textarea', { placeholder, ...attrs }) : h('input', { type, placeholder, ...attrs });
  el.value = obj[key] ?? '';
  el.addEventListener('input', () => { obj[key] = el.value; if (onInput) onInput(el.value, el); });
  return el;
}

/**
 * Tap-to-choose chips. Single (radio) or multiple (checkbox) selection.
 * opts: { options:[{value,label,hint,disabled}], value, values, multiple, max, onChange, name, allowNone }
 */
export function choiceGroup({ options, value = null, values = [], multiple = false, max = Infinity, onChange, name, allowNone = true, label }) {
  const group = h('div', { class: 'chips', role: multiple ? 'group' : 'radiogroup', 'aria-label': label || name || undefined });
  let selected = multiple ? new Set(values) : value;
  const buttons = [];

  function refresh() {
    for (const b of buttons) {
      const v = b.dataset.value;
      const on = multiple ? selected.has(v) : selected === v;
      b.setAttribute(multiple ? 'aria-pressed' : 'aria-checked', on ? 'true' : 'false');
      if (!multiple) b.tabIndex = (on || (selected == null && b === buttons[0])) ? 0 : -1;
      if (multiple && !on && selected.size >= max) b.disabled = true; else b.disabled = Boolean(b.dataset.disabled);
    }
  }

  options.forEach((o) => {
    const b = h('button', { type: 'button', class: 'chip', role: multiple ? undefined : 'radio', dataset: { value: String(o.value), disabled: o.disabled ? '1' : '' } },
      o.label, o.hint ? h('span', { class: 'hint' }, o.hint) : null);
    b.addEventListener('click', () => {
      const v = String(o.value);
      if (multiple) {
        if (selected.has(v)) selected.delete(v); else if (selected.size < max) selected.add(v); else return;
        refresh(); if (onChange) onChange([...selected]);
      } else {
        if (selected === v && allowNone) selected = null; else selected = v;
        refresh(); if (onChange) onChange(selected);
      }
    });
    b.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(b);
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % buttons.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + buttons.length) % buttons.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = buttons.length - 1;
      if (j != null) { e.preventDefault(); buttons[j].focus(); if (!multiple) buttons[j].click(); }
    });
    buttons.push(b);
    group.append(b);
  });
  refresh();
  group.getValue = () => (multiple ? [...selected] : selected);
  group.setValue = (v) => { selected = multiple ? new Set(v || []) : v; refresh(); };
  return group;
}

// ---------- Toast ----------
export function toast(msg, { kind = '', ms = 3500 } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const t = h('div', { class: 'toast ' + kind }, msg);
  region.append(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- Modal ----------
let openModal = null;
/**
 * modal({ title, body, buttons:[{label, value, primary, danger}], dismissable })
 * Resolves with the button value, or null when dismissed.
 */
export function modal({ title, body, buttons = [{ label: 'OK', value: 'ok', primary: true }], dismissable = true }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    if (openModal) openModal.close(null);
    const prevFocus = document.activeElement;
    const titleId = nextId('modal-title');
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
    const backdrop = h('div', { class: 'modal-backdrop' }, box);
    const close = (v) => {
      backdrop.remove(); openModal = null; document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(v);
    };
    openModal = { close };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) { e.preventDefault(); close(null); }
      if (e.key === 'Tab') {
        const f = [...box.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && dismissable) close(null); });
    box.append(h('h2', { id: titleId }, title));
    const content = h('div', { class: 'modal-body' });
    append(content, [typeof body === 'string' ? h('p', null, body) : body]);
    box.append(content);
    const row = h('div', { class: 'modal-buttons' });
    for (const b of buttons) {
      row.append(h('button', { type: 'button', class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => close(b.value ?? b.label) }, b.label));
    }
    box.append(row);
    root.append(backdrop);
    const firstBtn = row.querySelector('.btn.primary') || row.querySelector('.btn');
    (firstBtn || box).focus();
  });
}

export async function confirmDialog(title, text, { okLabel = 'Confirm', danger = false } = {}) {
  const v = await modal({ title, body: text, buttons: [{ label: 'Cancel', value: null }, { label: okLabel, value: 'ok', primary: !danger, danger }] });
  return v === 'ok';
}

// ---------- Helper popover ("See examples") ----------
/**
 * Returns a span with a visible "See examples" tap target; on desktop (pointer: fine)
 * hovering the trigger for ~1.5 s also reveals it. Content from FIELD_HELPERS[fieldKey]
 * (and HOBBY_EXAMPLES for 'hobbies').
 */
export function helperPopover(fieldKey, { triggerLabel = 'See examples', extra } = {}) {
  const info = helperFor(fieldKey);
  const popId = nextId('pop');
  const pop = h('div', { class: 'helper-pop', id: popId, role: 'region', 'aria-label': 'Examples', hidden: true });
  const trigger = h('button', { type: 'button', class: 'btn link helper-trigger', 'aria-expanded': 'false', 'aria-controls': popId }, triggerLabel);
  const wrap = h('span', { class: 'helper' }, trigger, pop);

  function fill() {
    clear(pop);
    pop.append(h('button', { type: 'button', class: 'btn small link close', 'aria-label': 'Close examples', onclick: () => show(false) }, 'Close'));
    if (info.definition) pop.append(h('p', null, info.definition));
    if (fieldKey === 'hobbies') {
      const t = h('table', null, h('thead', null, h('tr', null, h('th', null, 'Hobby'), h('th', null, 'What it can show (guidance only, never printed)'))));
      const tb = h('tbody');
      for (const ex of HOBBY_EXAMPLES) tb.append(h('tr', null, h('td', null, ex.name), h('td', null, ex.shows)));
      t.append(tb); pop.append(t);
    } else if (info.examples.length) {
      pop.append(h('p', { class: 'muted small' }, 'Examples'), h('ul', null, info.examples.map((e) => h('li', null, e))));
    }
    if (info.structures.length) pop.append(h('p', { class: 'muted small' }, 'Structures'), h('ul', null, info.structures.map((e) => h('li', null, e))));
    if (info.tips.length) pop.append(h('p', { class: 'muted small' }, 'Tips'), h('ul', null, info.tips.map((e) => h('li', null, e))));
    if (extra) append(pop, [extra]);
  }
  let pinned = false;
  function show(on) {
    if (on && !pop.childElementCount) fill();
    pop.hidden = !on;
    trigger.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) pinned = false;
  }
  trigger.addEventListener('click', () => { pinned = pop.hidden; show(pop.hidden); });
  // Secondary desktop trigger: ~1.5 s hover
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    let timer = null;
    trigger.addEventListener('mouseenter', () => { timer = setTimeout(() => { if (pop.hidden) { show(true); pinned = false; } }, 1500); });
    trigger.addEventListener('mouseleave', () => clearTimeout(timer));
    wrap.addEventListener('mouseleave', () => { if (!pinned) show(false); });
  }
  document.addEventListener('click', (e) => { if (!pop.hidden && !wrap.contains(e.target)) show(false); });
  return wrap;
}

// ---------- Tips card ----------
/** 2-3 tips. Open by default on desktop, collapsible on mobile. */
export function tipsCard(tips, { title = 'Tips' } = {}) {
  const desktop = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
  return h('details', { class: 'tips', open: desktop }, h('summary', null, title), h('ul', null, tips.slice(0, 3).map((t) => h('li', null, t))));
}

/** Live character counter under a textarea / input. */
export function charCounter(input, max) {
  const c = h('div', { class: 'charcount', 'aria-live': 'polite' });
  const upd = () => { const n = (input.value || '').length; c.textContent = `${n} / ${max}`; c.classList.toggle('over', n > max); };
  input.addEventListener('input', upd); upd();
  return c;
}

/** Download a text file. */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return String(iso || ''); }
}
