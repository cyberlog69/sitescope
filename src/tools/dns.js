// @ts-check
// dns.js — DNS DoH Query Module

import { escapeHtml } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';

/**
 * @typedef {{ name:string, type:number, TTL:number, data:string }} DnsAnswer
 * @typedef {Record<string, DnsAnswer[]>} DnsResultMap
 */

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'CAA'];

/**
 * @param {string} domain
 * @param {string} type
 * @returns {Promise<DnsAnswer[]>}
 */
export async function fetchDnsRecord(domain, type) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.Answer || [];
  } catch (e) {
    logError(`dns:fetchDnsRecord:${type}`, e);
    return [];
  }
}

/**
 * @param {string} domain
 * @returns {Promise<DnsResultMap>}
 */
export async function fetchAllDns(domain) {
  /** @type {DnsResultMap} */
  const results = {};
  await Promise.all(RECORD_TYPES.map(async type => {
    results[type] = await fetchDnsRecord(domain, type);
  }));
  return results;
}

/**
 * @param {DnsResultMap} dnsData
 * @param {HTMLElement | null} containerEl
 * @returns {void}
 */
export function renderDnsPanel(dnsData, containerEl) {
  if (!containerEl) return;

  let recordsCount = 0;
  let rowsHtml = '';
  const emailSecurity = { spf: 'Missing', dmarc: 'Missing' };

  Object.entries(dnsData).forEach(([type, records]) => {
    if (!records.length) return;
    recordsCount += records.length;

    records.forEach(r => {
      const value = r.data || '';
      
      // Parse email security configs
      if (type === 'TXT') {
        const lowerVal = value.toLowerCase();
        if (lowerVal.includes('v=spf1')) {
          emailSecurity.spf = 'Configured';
        }
        if (lowerVal.includes('v=dmarc1')) {
          emailSecurity.dmarc = 'Configured';
        }
      }

      rowsHtml += `
        <tr>
          <td><span class="badge badge-https">${type}</span></td>
          <td style="font-family:monospace;font-size:0.75rem;word-break:break-all;">${escapeHtml(value)}</td>
          <td>${r.TTL}s</td>
        </tr>
      `;
    });
  });

  const spfBadge = emailSecurity.spf === 'Configured' 
    ? '<span class="badge badge-ok">✓ SPF Configured</span>' 
    : '<span class="badge badge-err">✗ SPF Missing</span>';
    
  const dmarcBadge = emailSecurity.dmarc === 'Configured' 
    ? '<span class="badge badge-ok">✓ DMARC Configured</span>' 
    : '<span class="badge badge-err">✗ DMARC Missing</span>';

  if (recordsCount === 0) {
    containerEl.innerHTML = '<div class="info-value" style="padding:14px;text-align:center;">No DNS records retrieved.</div>';
    return;
  }

  containerEl.innerHTML = `
    <div style="padding:14px;display:flex;gap:10px;margin-bottom:10px;border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Email Security Status</div>
        <div style="display:flex;gap:8px;">
          ${spfBadge}
          ${dmarcBadge}
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Total Records</span>
        <strong style="color:var(--violet-2);font-size:1.1rem;font-family:'Space Grotesk',sans-serif;">${recordsCount}</strong>
      </div>
    </div>
    <div style="max-height:300px;overflow-y:auto;padding:0 14px 14px;">
      <table class="bulk-table" style="width:100%;font-size:0.8rem;">
        <thead>
          <tr>
            <th style="width:70px">Type</th>
            <th>Value</th>
            <th style="width:60px">TTL</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}


