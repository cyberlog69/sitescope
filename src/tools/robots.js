// robots.js — Robots.txt & Sitemap Analyzer Module

const ALLORIGINS = 'https://api.allorigins.win/get?url=';

// Paths that look sensitive / private
const SENSITIVE_PATTERNS = [
  /admin/i, /login/i, /api\//i, /wp-admin/i, /\.env/i,
  /config/i, /backup/i, /private/i, /secret/i, /internal/i,
  /phpmyadmin/i, /cpanel/i, /dashboard/i, /\.git/i, /auth/i,
];

function isSensitivePath(path) {
  return SENSITIVE_PATTERNS.some(p => p.test(path));
}

export async function fetchRobotsTxt(domain) {
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const res = await fetch(ALLORIGINS + encodeURIComponent(robotsUrl));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.contents || '';
  } catch (e) {
    console.error('Robots.txt fetch error:', e);
    return null;
  }
}

export function parseRobotsTxt(content) {
  if (!content || content.includes('<html')) return null;

  const lines = content.split(/\r?\n/);
  const rules = [];
  const sitemaps = [];
  let currentGroup = null;

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;

    const colonIdx = clean.indexOf(':');
    if (colonIdx === -1) return;

    const key = clean.slice(0, colonIdx).trim().toLowerCase();
    const val = clean.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      if (currentGroup) rules.push(currentGroup);
      currentGroup = { agent: val, allow: [], disallow: [] };
    } else if (key === 'disallow') {
      if (currentGroup && val) currentGroup.disallow.push(val);
    } else if (key === 'allow') {
      if (currentGroup && val) currentGroup.allow.push(val);
    } else if (key === 'sitemap') {
      sitemaps.push(val);
    }
  });

  if (currentGroup) rules.push(currentGroup);
  return { rules, sitemaps };
}

export function renderRobotsPanel(parsedData, containerEl) {
  if (!containerEl) return;

  if (!parsedData || (!parsedData.rules.length && !parsedData.sitemaps.length)) {
    containerEl.innerHTML = `
      <div class="info-value" style="padding:14px;text-align:center;">
        No robots.txt detected, or file is empty / blocks proxy fetching.
      </div>
    `;
    return;
  }

  // Check for sensitive paths
  const sensitiveDisallows = [];
  parsedData.rules.forEach(g => {
    g.disallow.forEach(path => {
      if (isSensitivePath(path)) {
        sensitiveDisallows.push({ agent: g.agent, path });
      }
    });
  });

  let alertsHtml = '';
  if (sensitiveDisallows.length > 0) {
    const uniquePaths = Array.from(new Set(sensitiveDisallows.map(d => d.path))).slice(0, 5);
    alertsHtml = `
      <div class="sec-finding warn" style="margin:14px;border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-xs);padding:8px 12px;background:rgba(245,158,11,0.02);font-size:0.75rem;">
        <strong style="color:var(--yellow);display:block;margin-bottom:3px;">⚠️ Sensitive Paths Disclosed</strong>
        Robots.txt contains rules disallowing access to paths like: 
        <code style="color:var(--yellow);background:rgba(0,0,0,0.2);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.7rem;">${escapeHtml(uniquePaths.join(', '))}</code>. 
        This might expose admin logins, APIs, or private folders.
      </div>
    `;
  }

  let rulesHtml = parsedData.rules.slice(0, 5).map(g => {
    const allowText = g.allow.slice(0, 5).map(p => `Allow: ${p}`).join('<br/>');
    const disallowText = g.disallow.slice(0, 5).map(p => `Disallow: ${p}`).join('<br/>');
    
    return `
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-xs);padding:10px;margin-bottom:8px;font-family:monospace;font-size:0.75rem;line-height:1.4;">
        <strong style="color:var(--violet-2);">User-agent: ${escapeHtml(g.agent)}</strong><br/>
        ${allowText ? `<span style="color:var(--green);">${allowText}</span><br/>` : ''}
        ${disallowText ? `<span style="color:var(--red);">${disallowText}</span>` : ''}
      </div>
    `;
  }).join('');

  let sitemapsHtml = '';
  if (parsedData.sitemaps.length > 0) {
    sitemapsHtml = `
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;">
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Sitemaps Found</div>
        ${parsedData.sitemaps.slice(0, 3).map(s => {
          return `<div style="font-family:monospace;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="${escapeHtml(s)}" target="_blank" style="color:var(--cyan);text-decoration:none;">${escapeHtml(s)} ↗</a></div>`;
        }).join('')}
      </div>
    `;
  }

  containerEl.innerHTML = `
    ${alertsHtml}
    <div style="padding:14px;">
      <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Robots.txt Rules Summary</div>
      ${rulesHtml || '<div class="info-value">No parseable rules.</div>'}
      ${sitemapsHtml}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
