// @ts-check
// subdomains.js — Subdomain Discovery Engine via Certificate Transparency (crt.sh)

import { fetchViaCorsProxy } from '../utils/proxy.js';

/**
 * @typedef {{
 *   domain: string,
 *   subdomains: string[],
 *   categories: Record<string, string[]>,
 *   totalCount: number,
 *   error?: string
 * }} SubdomainResult
 */

const CATEGORY_RULES = [
  { name: 'Dev/Staging', icon: '🛠️', keywords: ['dev', 'stage', 'staging', 'test', 'qa', 'beta', 'sandbox', 'internal', 'demo', 'preview'] },
  { name: 'Admin/Auth', icon: '🔐', keywords: ['admin', 'auth', 'login', 'sso', 'portal', 'vault', 'identity', 'oauth', 'manage', 'account'] },
  { name: 'API/Services', icon: '⚡', keywords: ['api', 'v1', 'v2', 'grpc', 'graphql', 'ws', 'gateway', 'service', 'micro', 'rpc'] },
  { name: 'Mail/DNS', icon: '📧', keywords: ['mail', 'smtp', 'imap', 'pop', 'mx', 'dns', 'ns1', 'ns2', 'autodiscover', 'webmail'] },
  { name: 'Web App', icon: '🌐', keywords: ['app', 'www', 'dashboard', 'cloud', 'cdn', 'static', 'assets', 'store', 'media', 'blog'] }
];

/**
 * Parse crt.sh API payload (array of certificate records) into unique sorted subdomains.
 * @param {any[]} records
 * @param {string} baseDomain
 * @returns {SubdomainResult}
 */
export function parseCrtShResponse(records, baseDomain) {
  if (!Array.isArray(records)) {
    return { domain: baseDomain, subdomains: [], categories: {}, totalCount: 0, error: 'Invalid response format from crt.sh' };
  }

  const baseLower = baseDomain.toLowerCase().replace(/^www\./, '');
  const subdomainSet = new Set();

  records.forEach((rec) => {
    if (!rec || !rec.name_value) return;
    const names = String(rec.name_value).split(/[\n\r\s]+/);
    names.forEach((name) => {
      let cleaned = name.trim().toLowerCase();
      // Remove wildcard prefix *.
      if (cleaned.startsWith('*.')) cleaned = cleaned.substring(2);

      // Verify it ends with baseDomain and is not just baseDomain itself
      if (cleaned.endsWith(`.${baseLower}`) && cleaned !== baseLower) {
        subdomainSet.add(cleaned);
      }
    });
  });

  const subdomains = Array.from(subdomainSet).sort();

  /** @type {Record<string, string[]>} */
  const categories = {
    'Dev/Staging': [],
    'Admin/Auth': [],
    'API/Services': [],
    'Mail/DNS': [],
    'Web App': [],
    'Other': []
  };

  subdomains.forEach((sub) => {
    const prefix = sub.substring(0, sub.length - baseLower.length - 1);
    let matched = false;
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((kw) => prefix.includes(kw))) {
        categories[rule.name].push(sub);
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories['Other'].push(sub);
    }
  });

  return {
    domain: baseDomain,
    subdomains,
    categories,
    totalCount: subdomains.length
  };
}

/**
 * Fetch subdomains for a given domain via crt.sh Certificate Transparency logs.
 * @param {string} baseDomain
 * @returns {Promise<SubdomainResult>}
 */
export async function fetchSubdomains(baseDomain) {
  const cleanDomain = baseDomain.trim().toLowerCase().replace(/^www\./, '');
  if (!cleanDomain) {
    return { domain: baseDomain, subdomains: [], categories: {}, totalCount: 0, error: 'Invalid domain' };
  }

  const directUrl = `https://crt.sh/?q=%.${cleanDomain}&output=json`;

  try {
    const res = await fetch(directUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      return parseCrtShResponse(data, cleanDomain);
    }
  } catch {
    // Fall back to CORS proxy chain if direct fetch fails (e.g. CORS block)
  }

  try {
    const proxyRes = await fetchViaCorsProxy(directUrl, { timeout: 12000 });
    if (proxyRes && proxyRes.contents) {
      const data = JSON.parse(proxyRes.contents);
      return parseCrtShResponse(data, cleanDomain);
    }
  } catch (err) {
    return {
      domain: cleanDomain,
      subdomains: [],
      categories: {},
      totalCount: 0,
      error: err instanceof Error ? err.message : 'Failed to query crt.sh CT logs'
    };
  }

  return {
    domain: cleanDomain,
    subdomains: [],
    categories: {},
    totalCount: 0,
    error: 'No subdomain certificate records returned'
  };
}
