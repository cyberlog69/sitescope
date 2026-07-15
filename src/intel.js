// @ts-check
// intel.js — WHOIS & HTTP Header intel panel
// SECURITY: All API-returned data is escaped via escapeHtml() before any DOM injection.

import { escapeHtml } from './utils/helpers.js';

export async function fetchWhois(domain) {
  const whoisEl = document.getElementById('intelWhois');
  if (!whoisEl) return;

  // Use textContent for loading state (no HTML injection risk)
  whoisEl.textContent = 'Fetching WHOIS…';

  try {
    // Use RDAP (Registration Data Access Protocol) — standards-based, JSON, no rate limits
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error(`RDAP: ${res.status}`);
    const data = await res.json();

    // Extract registrar and dates safely
    const registrar = data.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]
      ?.find(v => v[0] === 'fn')?.[3] || 'Unknown';

    const created = data.events?.find(e => e.eventAction === 'registration')?.eventDate;
    const expires = data.events?.find(e => e.eventAction === 'expiration')?.eventDate;

    const createdStr = created ? new Date(created).toLocaleDateString() : 'Unknown';
    const expiresStr = expires ? new Date(expires).toLocaleDateString() : 'Unknown';

    // Build DOM nodes — no innerHTML with API data
    whoisEl.innerHTML = ''; // Clear loading
    const lines = [
      ['Registrar', registrar],
      ['Created',   createdStr],
      ['Expires',   expiresStr],
    ];
    lines.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'whois-row';
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      const span = document.createElement('span');
      span.textContent = value;  // textContent — safe even if value contains HTML chars
      row.appendChild(strong);
      row.appendChild(span);
      whoisEl.appendChild(row);
    });

  } catch (e) {
    // Fallback to allorigins RDAP proxy if direct fetch fails
    try {
      const fallback = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent('https://rdap.verisign.com/com/v1/domain/' + domain)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const proxy = await fallback.json();
      const rdap = JSON.parse(proxy.contents || '{}');
      const registrar = rdap.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]
        ?.find(v => v[0] === 'fn')?.[3] || 'Unknown';
      whoisEl.textContent = `Registrar: ${registrar}`;
    } catch {
      whoisEl.textContent = 'WHOIS unavailable';
    }
  }
}

export async function fetchHttpHeaders(domain) {
  const headersEl = document.getElementById('intelHeaders');
  if (!headersEl) return;
  headersEl.textContent = 'Fetching headers…';

  // Important security headers to surface
  const SECURITY_HEADERS = new Set([
    'server',
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'referrer-policy',
    'permissions-policy',
    'x-powered-by',
    'content-type',
    'cache-control',
  ]);

  try {
    // Use HackerTarget via allorigins proxy to avoid direct API rate-limit exposure
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent('https://api.hackertarget.com/httpheaders/?q=' + encodeURIComponent(domain))}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const proxy = await res.json();
    const text  = proxy.contents || '';

    if (!text || text.includes('error') || text.includes('rate limit') || text.includes('valid key required')) {
      headersEl.textContent = 'Headers unavailable (API rate-limit reached)';
      return;
    }

    const lines = text.split(/\r?\n/);
    headersEl.innerHTML = ''; // Clear loading
    let found = 0;

    lines.forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      if (!SECURITY_HEADERS.has(key)) return;

      found++;
      // Build DOM nodes — no innerHTML with API data
      const row = document.createElement('div');
      row.className = 'header-line';
      const strong = document.createElement('strong');
      strong.textContent = key + ': ';     // textContent — XSS safe
      const span = document.createElement('span');
      span.textContent = val;              // textContent — XSS safe
      row.appendChild(strong);
      row.appendChild(span);
      headersEl.appendChild(row);
    });

    if (found === 0) {
      headersEl.textContent = 'No significant security headers detected.';
    }
  } catch (e) {
    headersEl.textContent = 'Headers unavailable';
  }
}
