// @ts-check
// proxy.js — CORS proxy fallback chain.
//
// A handful of tools (SSL/crt.sh lookup, robots.txt fetch, WHOIS/header intel)
// need to read a cross-origin resource that doesn't send CORS headers. We
// route these through free public CORS proxies. Relying on a single proxy
// (allorigins.win) means one dead free service breaks several features at
// once, so this module tries a short chain of proxies and normalizes their
// differing response shapes into a single `{ contents }` result.

import { logWarn } from './logger.js';

/**
 * @typedef {{ contents: string }} ProxyResult
 */

/**
 * Each entry builds a proxy URL for a target URL, and knows how to extract
 * the raw body text from that proxy's response shape.
 * @type {Array<{ build: (url: string) => string, extract: (res: Response) => Promise<string | null> }>}
 */
const PROXIES = [
  {
    // allorigins wraps the response as JSON: { contents, status, ... }
    build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extract: async (res) => {
      const json = await res.json();
      return typeof json?.contents === 'string' ? json.contents : null;
    }
  },
  {
    // corsproxy.io passes the target response straight through
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    extract: async (res) => {
      const text = await res.text();
      return text || null;
    }
  },
  {
    // codetabs passes the target response straight through as text
    build: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    extract: async (res) => {
      const text = await res.text();
      return text || null;
    }
  }
];

/**
 * Fetch a cross-origin URL through a chain of CORS proxies, trying each in
 * order until one succeeds.
 * @param {string} targetUrl - the real URL to fetch (unencoded)
 * @param {{ timeout?: number, cacheBust?: boolean }} [opts]
 * @returns {Promise<ProxyResult | null>}
 */
export async function fetchViaCorsProxy(targetUrl, opts = {}) {
  const { timeout = 8000, cacheBust = false } = opts;

  for (const proxy of PROXIES) {
    try {
      let proxyUrl = proxy.build(targetUrl);
      if (cacheBust) {
        const sep = proxyUrl.includes('?') ? '&' : '?';
        proxyUrl = `${proxyUrl}${sep}timestamp=${Date.now()}`;
      }
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) continue;
      const contents = await proxy.extract(res);
      if (contents !== null) return { contents };
    } catch (err) {
      logWarn('proxy:fetchViaCorsProxy', err);
    }
  }
  return null;
}
