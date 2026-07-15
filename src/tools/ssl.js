// ssl.js — Certificate Transparency & SSL Info Module

import { escapeHtml } from '../utils/helpers.js';

const ALLORIGINS = 'https://api.allorigins.win/get?url=';

export async function fetchSslInfo(domain) {
  try {
    // Fetch certificate logs via crt.sh JSON endpoint (proxied to bypass CORS)
    const targetUrl = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const res = await fetch(ALLORIGINS + encodeURIComponent(targetUrl));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = JSON.parse(json.contents || '[]');
    return data;
  } catch (e) {
    console.error('SSL fetch error:', e);
    return null;
  }
}

export function renderSslPanel(sslData, domain, containerEl) {
  if (!containerEl) return;

  if (!sslData || !sslData.length) {
    containerEl.innerHTML = `
      <div class="info-value" style="padding:14px;text-align:center;">
        No certificate logs found on crt.sh for <code style="color:var(--yellow);">${escapeHtml(domain)}</code>.
      </div>
    `;
    return;
  }

  // Filter out expired and sort by newest
  const activeCerts = sslData.filter(c => {
    const expires = new Date(c.not_after);
    return expires > new Date();
  });

  const latestCert = activeCerts[0] || sslData[0];
  const issuer = latestCert.issuer_name || 'Unknown Issuer';
  const created = new Date(latestCert.not_before);
  const expires = new Date(latestCert.not_after);
  const remainingMs = expires - new Date();
  const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

  // Calculate Grade
  let grade = 'A';
  let gradeClass = 'badge-ok';
  
  if (remainingDays <= 0) {
    grade = 'F';
    gradeClass = 'badge-err';
  } else if (remainingDays < 15) {
    grade = 'C';
    gradeClass = 'badge-warn';
  } else if (remainingDays < 30) {
    grade = 'B';
    gradeClass = 'badge-warn';
  }

  // Collect unique SAN domains (up to 8)
  const uniqueSans = new Set();
  sslData.slice(0, 50).forEach(c => {
    if (c.common_name) uniqueSans.add(c.common_name);
  });
  const sanListHtml = Array.from(uniqueSans).slice(0, 10).map(s => {
    return `<span class="tag" style="font-size:0.7rem;margin:2px;display:inline-block;">${escapeHtml(s)}</span>`;
  }).join('');

  containerEl.innerHTML = `
    <div style="padding:14px;display:grid;grid-template-columns:100px 1fr;gap:14px;border-bottom:1px solid var(--border);align-items:center;">
      <div style="text-align:center;">
        <div style="font-size:0.6rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">SSL Grade</div>
        <div style="font-size:2.4rem;font-weight:800;font-family:'Space Grotesk',sans-serif;line-height:1;margin-bottom:4px;" class="${grade === 'A' ? 'text-green' : grade === 'F' ? 'text-red' : 'text-yellow'}">
          ${grade}
        </div>
        <span class="badge ${gradeClass}" style="font-size:0.65rem;">${remainingDays} Days Left</span>
      </div>
      <div>
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Certificate Authority</div>
        <div class="info-value" style="font-size:0.8rem;font-weight:600;margin-bottom:6px;">${escapeHtml(issuer.split(',')[0].replace('O=', '').replace('CN=', ''))}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">
          Issued: ${created.toLocaleDateString()}<br/>
          Expires: ${expires.toLocaleDateString()}
        </div>
      </div>
    </div>
    <div style="padding:14px;">
      <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Subject Alternative Names (SANs)</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;">
        ${sanListHtml || '<span style="font-size:0.75rem;color:var(--text-dim);">None detected.</span>'}
      </div>
    </div>
  `;
}


