// Deployment configuration. All values are optional.
//
// Leave everything empty to run fully offline: rules-only extraction,
// company check shown as "Not checked", and all data kept in this
// browser's localStorage. Nothing is sent anywhere.
//
// To enable the optional backend (Supabase edge functions for link fetching,
// company verification and AI assist, plus opt-in account sync), fill in:
//   SUPABASE_URL      e.g. 'https://abcdefgh.supabase.co'
//   SUPABASE_ANON_KEY the project's public anon key (safe to ship to browsers)
//   FUNCTIONS_URL     optional; defaults to SUPABASE_URL + '/functions/v1'
export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  FUNCTIONS_URL: '' /* defaults to SUPABASE_URL + '/functions/v1' */
};

/** Base URL for edge functions, or '' when no backend is configured. */
export function functionsUrl() {
  if (CONFIG.FUNCTIONS_URL) return CONFIG.FUNCTIONS_URL.replace(/\/+$/, '');
  if (CONFIG.SUPABASE_URL) return CONFIG.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1';
  return '';
}

/** True when a Supabase backend is configured (sync + functions possible). */
export function hasBackend() {
  return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}
