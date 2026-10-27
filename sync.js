// Optional account sync (opt-in). The Supabase client is loaded lazily and only
// when CONFIG has a backend AND the student enabled sync in Settings.
// Never uploads basics.photoDataUrl.
import { CONFIG, hasBackend } from './config.js';
import { loadProfile } from './store.js';

let clientPromise = null;

function syncAllowed() {
  if (!hasBackend()) return false;
  try { return Boolean(loadProfile().settings?.syncEnabled); } catch (e) { return false; }
}

/** Returns the Supabase client, or null when sync is not configured / not enabled. */
export async function getClient() {
  if (!syncAllowed()) return null;
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY))
      .catch((e) => { console.warn('Supabase client failed to load', e); clientPromise = null; return null; });
  }
  return clientPromise;
}

export async function getUser() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.user || null;
}

export async function getAccessToken() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.access_token || null;
}

export async function signInWithMagicLink(email) {
  const c = await getClient();
  if (!c) return { ok: false, message: 'Sync is not configured.' };
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  return error ? { ok: false, message: error.message } : { ok: true, message: 'Check your email for the sign-in link.' };
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
}

/** Strip anything that must never leave the device. */
export function stripForUpload(profile) {
  const copy = JSON.parse(JSON.stringify(profile));
  if (copy.basics) delete copy.basics.photoDataUrl;
  return copy;
}

export async function pushProfile(profile) {
  const c = await getClient();
  const user = await getUser();
  if (!c || !user) return { ok: false, message: 'Not signed in.' };
  const { error } = await c.from('profiles').upsert({ user_id: user.id, data: stripForUpload(profile), updated_at: new Date().toISOString() });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/** Returns the remote profile data (without photo) or null. */
export async function pullProfile() {
  const c = await getClient();
  const user = await getUser();
  if (!c || !user) return null;
  const { data, error } = await c.from('profiles').select('data, updated_at').eq('user_id', user.id).maybeSingle();
  if (error || !data) return null;
  return data.data || null;
}

function snapshotRow(snap, userId) {
  const session = snap.session ? JSON.parse(JSON.stringify(snap.session)) : null;
  const model = snap.model ? JSON.parse(JSON.stringify(snap.model)) : null;
  if (model?.header) model.header.photoDataUrl = null;
  return {
    id: snap.id, user_id: userId, company: snap.company || '', role_title: snap.role || '',
    file_name: snap.fileName || '', template: snap.template || 'text_first', model, session,
    created_at: snap.date || new Date().toISOString()
  };
}

export async function pushSnapshots(snapshots) {
  const c = await getClient();
  const user = await getUser();
  if (!c || !user) return { ok: false, message: 'Not signed in.' };
  if (!snapshots.length) return { ok: true };
  const { error } = await c.from('snapshots').upsert(snapshots.map((s) => snapshotRow(s, user.id)));
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function pullSnapshots() {
  const c = await getClient();
  const user = await getUser();
  if (!c || !user) return [];
  const { data, error } = await c.from('snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, company: r.company, role: r.role_title, date: r.created_at, template: r.template,
    fileName: r.file_name, model: r.model, session: r.session }));
}
