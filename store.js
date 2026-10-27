// Local-first persistence. Everything lives in localStorage under four keys.
// Sync (sync.js) is optional and only ever copies what is here.
import { newProfile, migrateProfile, validateProfile, newId } from './core/schema.js';

export const KEYS = {
  profile: 'hr.profile',
  sessions: 'hr.sessions',
  snapshots: 'hr.snapshots',
  settings: 'hr.settings'
};

const listeners = new Set();
/** Subscribe to store changes: cb(key). Returns an unsubscribe function. */
export function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit(key) { for (const cb of listeners) { try { cb(key); } catch (e) { console.error(e); } } }

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read', key, e);
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emit(key);
    return true;
  } catch (e) {
    console.error('Could not save', key, e);
    return false;
  }
}

// ---------- Profile ----------
let profileCache = null;

export function loadProfile() {
  if (profileCache) return profileCache;
  const raw = readJson(KEYS.profile, null);
  let p = null;
  if (raw && typeof raw === 'object') {
    try { p = migrateProfile(raw); } catch (e) { console.warn('migrateProfile failed, starting fresh', e); }
  }
  if (!p) p = newProfile();
  if (!p.settings) p.settings = { pageSize: 'A4', aiEnabled: false, syncEnabled: false };
  profileCache = p;
  return p;
}

export function saveProfile(p = profileCache) {
  if (!p) return false;
  profileCache = p;
  return writeJson(KEYS.profile, p);
}

/** Replace the profile entirely (import / pull). */
export function replaceProfile(p) {
  profileCache = migrateProfile(p);
  return saveProfile(profileCache);
}

/** True when the student has not filled in anything meaningful yet. */
export function isProfileEmpty(p = loadProfile()) {
  const b = p.basics || {};
  return !(b.fullName || b.email) && !(p.entries || []).length && !(p.education || []).length;
}

/** Fewer than 2 entries across Experience, Projects, Extracurriculars and Achievements. */
export function isProfileSparse(p = loadProfile()) {
  const n = (p.entries || []).length + (p.extracurriculars || []).length + (p.achievements || []).length;
  return n < 2;
}

export function exportProfileJson(p = loadProfile()) {
  return JSON.stringify(p, null, 2);
}

/** Parse, migrate and validate JSON text. Returns { ok, errors, profile }. Does not save. */
export function importProfileJson(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: ['This file is not valid JSON.'], profile: null }; }
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['The file does not contain a profile object.'], profile: null };
  let profile;
  try { profile = migrateProfile(obj); } catch (e) { return { ok: false, errors: ['Could not read this profile: ' + (e && e.message)], profile: null }; }
  let v = { ok: true, errors: [] };
  try { v = validateProfile(profile) || v; } catch (e) { v = { ok: false, errors: [String(e && e.message)] }; }
  return { ok: Boolean(v.ok), errors: v.errors || [], profile };
}

// ---------- App settings (app-level, separate from profile.settings) ----------
const DEFAULT_SETTINGS = {
  currentSessionId: null,
  dontShowAgain: {},          // { photo: true, two_column: true, ... }
  onboardingDismissed: false,
  aiDisclosureAccepted: false,
  syncEmail: ''
};
let settingsCache = null;
export function loadSettings() {
  if (settingsCache) return settingsCache;
  settingsCache = { ...DEFAULT_SETTINGS, ...(readJson(KEYS.settings, {}) || {}) };
  if (!settingsCache.dontShowAgain) settingsCache.dontShowAgain = {};
  return settingsCache;
}
export function saveSettings(s = settingsCache) {
  settingsCache = s;
  return writeJson(KEYS.settings, s);
}
export function updateSettings(patch) {
  const s = { ...loadSettings(), ...patch };
  return saveSettings(s);
}

// ---------- Sessions ----------
export function loadSessions() {
  const list = readJson(KEYS.sessions, []);
  return Array.isArray(list) ? list : [];
}
export function saveSessions(list) { return writeJson(KEYS.sessions, list); }
export function getSession(id) { return loadSessions().find((s) => s.id === id) || null; }
export function upsertSession(session) {
  const list = loadSessions();
  const i = list.findIndex((s) => s.id === session.id);
  if (i >= 0) list[i] = session; else list.push(session);
  return saveSessions(list);
}
export function deleteSession(id) {
  saveSessions(loadSessions().filter((s) => s.id !== id));
  const st = loadSettings();
  if (st.currentSessionId === id) updateSettings({ currentSessionId: null });
}

// ---------- Snapshots ----------
export function loadSnapshots() {
  const list = readJson(KEYS.snapshots, []);
  return Array.isArray(list) ? list : [];
}
export function saveSnapshots(list) { return writeJson(KEYS.snapshots, list); }
export function addSnapshot(snap) {
  const list = loadSnapshots();
  if (!snap.id) snap.id = newId();
  list.unshift(snap);
  saveSnapshots(list);
  return snap;
}
export function deleteSnapshot(id) { return saveSnapshots(loadSnapshots().filter((s) => s.id !== id)); }

// ---------- Delete everything ----------
export function deleteEverything() {
  for (const k of Object.values(KEYS)) localStorage.removeItem(k);
  try { sessionStorage.clear(); } catch (e) { /* ignore */ }
  profileCache = null;
  settingsCache = null;
  emit('*');
}

// ---------- Autosave helper ----------
/** Debounce: returns a function that runs fn at most once per `ms` after the last call. */
export function debounce(fn, ms = 400) {
  let t = null;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; fn(...args); } };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

/** Debounced profile autosave shared by views. */
export const autosaveProfile = debounce(() => saveProfile(), 400);
window.addEventListener('beforeunload', () => autosaveProfile.flush());
window.addEventListener('pagehide', () => autosaveProfile.flush());

export { newId };
