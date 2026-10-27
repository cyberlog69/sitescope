// @ts-check
// bulk.js — Bulk URL checker: input parsing + per-URL metadata/threat fetch.

import { normalizeUrl, getDomain } from '../utils/helpers.js';
import { classifySite } from '../modules/category.js';
import { heuristicScan } from '../modules/security.js';

export const MAX_BULK_URLS = 25;

/**
 * @typedef {{ ok: boolean, url: string, title: string, desc: string, lang: string|null,
 *   category: import('../modules/category.js').CategoryDef, threat: ReturnType<typeof heuristicScan>,
 *   favicon: string, index?: number }} BulkResult
 */

/**
 * Parse newline/comma separated raw text into a list of normalized, valid URLs.
 * @param {string} text
 * @param {number} [max]
 * @returns {string[]}
 */
export function parseBulkUrls(text, max = MAX_BULK_URLS) {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizeUrl(s))
    .filter(/** @returns {url is string} */ (url) => typeof url === 'string')
    .slice(0, max);
}

/**
 * Fetch metadata for a single URL (via Microlink) and classify/scan it.
 * @param {string} url
 * @returns {Promise<BulkResult>}
 */
export async function fetchSiteData(url) {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&video=false`;
  const favicon = `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`;

  const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
  const json = await res.json();

  if (json.status === 'success' || json.status === 'partial') {
    const d = json.data;
    const title = d.title || d.publisher || getDomain(url);
    const desc = d.description || '';
    const lang = d.lang || null;
    const { category } = classifySite(url, title, desc);
    const threat = heuristicScan(url);
    return { ok: true, url, title, desc, lang, category, threat, favicon };
  }

  const { category } = classifySite(url, getDomain(url), '');
  const threat = heuristicScan(url);
  return {
    ok: false,
    url,
    title: getDomain(url),
    desc: 'Could not fetch metadata.',
    lang: null,
    category,
    threat,
    favicon
  };
}

/**
 * Build a fallback result (used when fetchSiteData throws) so bulk checks
 * never abort the whole batch on a single failed request.
 * @param {string} url
 * @returns {BulkResult}
 */
export function fallbackSiteData(url) {
  const { category } = classifySite(url, getDomain(url), '');
  const threat = heuristicScan(url);
  return {
    ok: false,
    url,
    title: getDomain(url),
    desc: 'Error fetching data.',
    lang: null,
    category,
    threat,
    favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`
  };
}
