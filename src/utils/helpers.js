// @ts-check

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Normalize a user-entered URL – adds https:// if no protocol given.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  raw = raw.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { return new URL(raw).href; }
  catch { return null; }
}

/**
 * Extract the domain hostname from a URL, stripping leading www.
 * @param {string} url
 * @returns {string}
 */
export function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

/**
 * Promise-based sleep / delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Validate an href value — only http/https allowed, others become '#'.
 * @param {*} url
 * @returns {string}
 */
export function safeHref(url) {
  if (typeof url !== 'string') return '#';
  const t = url.trim();
  return (t.startsWith('https://') || t.startsWith('http://')) ? escapeHtml(t) : '#';
}
