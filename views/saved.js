// Saved versions: approved snapshots stored locally (hr.snapshots).
import { h, clear, toast, confirmDialog, formatDate } from '../ui.js';
import { loadSnapshots, deleteSnapshot, loadProfile } from '../store.js';
import { printModel } from '../render.js';
import { newSession, templateSpec, saveSession, setCurrentSession, normalizeSession } from '../session.js';
import { templateById } from '../catalog.js';

export function renderSaved(view) {
  clear(view);
  view.append(h('div', { class: 'page-title' }, h('h1', null, 'Saved versions'),
    h('span', { class: 'muted small' }, 'Every approved resume is kept here on this device.')));
  const snaps = loadSnapshots();
  if (!snaps.length) {
    view.append(h('div', { class: 'card' }, h('p', null, 'No approved resumes yet.'),
      h('p', { class: 'muted' }, 'Finish a tailoring session and approve it; the exact content and template are saved here.'),
      h('a', { class: 'btn primary', href: '#/tailor' }, 'Start tailoring')));
    return;
  }
  const list = h('div', { class: 'stack' });
  for (const s of snaps) {
    const tpl = templateById(s.template);
    const card = h('div', { class: 'card' },
      h('div', { class: 'item-head' },
        h('h2', null, `${s.company || 'Company'} - ${s.role || 'Role'}`),
        h('span', { class: 'muted small' }, formatDate(s.date))),
      h('p', { class: 'small' }, h('strong', null, 'File: '), s.fileName || '', h('br'),
        h('strong', null, 'Template: '), tpl.label, ' ', h('span', { class: 'badge' }, s.model?.pageSize || 'A4')),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: () => duplicate(s) }, 'Duplicate'),
        h('button', { type: 'button', class: 'btn', onclick: () => reprint(s) }, 'Reprint'),
        h('button', { type: 'button', class: 'btn danger', onclick: async () => {
          if (await confirmDialog('Delete this saved version?', 'Downloaded PDF copies on your device are not affected.', { okLabel: 'Delete', danger: true })) {
            deleteSnapshot(s.id); toast('Deleted'); renderSaved(view);
          }
        } }, 'Delete')));
    list.append(card);
  }
  view.append(list);
}

function duplicate(snap) {
  const src = snap.session ? normalizeSession(snap.session) : null;
  const s = newSession();
  if (src) {
    s.role = { ...src.role };
    s.extraction = JSON.parse(JSON.stringify(src.extraction));
    s.family = { ...src.family };
    s.selection = JSON.parse(JSON.stringify(src.selection));
    s.linkOverrides = { ...src.linkOverrides };
    s.template = { ...src.template };
    s.confirmations = JSON.parse(JSON.stringify(src.confirmations || []));
    s.overlay = JSON.parse(JSON.stringify(src.overlay || { skills: [] }));
    s.bulletEdits = { ...(src.bulletEdits || {}) };
    s.numberConfirmations = JSON.parse(JSON.stringify(src.numberConfirmations || {}));
    s.companyCheck = { ...src.companyCheck };
  } else {
    s.role.company = snap.company || ''; s.role.title = snap.role || '';
    s.template = templateSpec(snap.template);
  }
  s.ui.step = 1;
  saveSession(s);
  setCurrentSession(s.id);
  toast('Duplicated. Adjust the role and continue.');
  location.hash = '#/tailor';
}

function reprint(snap) {
  if (!snap.model) { toast('This snapshot has no stored content.', { kind: 'warn' }); return; }
  const model = JSON.parse(JSON.stringify(snap.model));
  // The photo is stored on the device only; restore it from the current profile for photo templates.
  if (snap.template === 'two_column_photo' && model.header && !model.header.photoDataUrl) {
    model.header.photoDataUrl = loadProfile().basics?.photoDataUrl || null;
  }
  printModel(model, snap.template, model.pageSize || 'A4', snap.fileName);
}
