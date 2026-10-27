/**
 * Approval snapshot hashing: sha-256 over a stable (sorted-key) JSON encoding of model + template.
 */

/**
 * JSON.stringify with object keys sorted recursively so equal data always yields equal text.
 * `undefined` values are dropped (as JSON.stringify does).
 * @param {any} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Hex sha-256 of a UTF-8 string using WebCrypto.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256Hex(text) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash the approved snapshot: JSON(model + template) with sorted keys.
 * Any edit to the model or a template change yields a different hash.
 * @param {object} model ResumeModel
 * @param {object|string} template session.template (object) or template id
 * @returns {Promise<string>} hex digest
 */
export async function snapshotHash(model, template) {
  return sha256Hex(stableStringify({ model, template }));
}
