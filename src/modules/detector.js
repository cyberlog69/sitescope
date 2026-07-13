import { measureLatencySingle } from '../tools/latency.js';

const OUTAGE_KV_BUCKET = 'sitescope_v4_history';

const POPULAR_SERVICES = [
  { name: 'Google',    domain: 'google.com',    color: '#4285F4' },
  { name: 'YouTube',   domain: 'youtube.com',   color: '#FF0000' },
  { name: 'GitHub',    domain: 'github.com',    color: '#8b5cf6' },
  { name: 'Netflix',   domain: 'netflix.com',   color: '#E50914' },
  { name: 'OpenAI',    domain: 'openai.com',    color: '#10a37f' },
  { name: 'Amazon',    domain: 'amazon.com',    color: '#FF9900' },
  { name: 'Cloudflare',domain: 'cloudflare.com',color: '#F38020' },
  { name: 'Discord',   domain: 'discord.com',   color: '#5865F2' },
  { name: 'X / Twitter',domain: 'x.com',        color: '#1DA1F2' },
];

let pollIntervalId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanDomainKey(urlOrDomain) {
  try {
    let h = urlOrDomain;
    if (/^https?:\/\//i.test(h)) h = new URL(h).hostname;
    return h.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9._-]/g, '_');
  } catch {
    return urlOrDomain.replace(/[^a-z0-9._-]/g, '_');
  }
}

function getHostname(urlOrDomain) {
  try {
    let h = urlOrDomain;
    if (/^https?:\/\//i.test(h)) h = new URL(h).hostname;
    return h.toLowerCase().replace(/^www\./, '');
  } catch {
    return urlOrDomain.toLowerCase();
  }
}

// Returns the best favicon URL for a domain with fallback chain
function faviconUrl(domain) {
  // Google's S2 service is highly reliable (returns 16px placeholder, never breaks)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// ── Probe 1: Direct no-cors HEAD ──────────────────────────────────────────────
// KEY INSIGHT: With mode:'no-cors', the fetch ONLY throws (rejects) on a true
// network failure (DNS NXDOMAIN, TCP refused, timeout). A 4xx/5xx from the
// server still resolves (opaque response). So: resolves = server exists,
// throws = server unreachable. This is the most reliable local probe.
async function probeDirectHead(domain) {
  const start = performance.now();
  try {
    await fetch('https://' + domain, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    return { ok: true, latency: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latency: null };
  }
}

// ── Probe 2: allorigins CORS proxy ────────────────────────────────────────────
// Checks global reachability from an external server (not the user's ISP).
// If this returns ok but HEAD failed → site is up globally, issue is local.
async function probeViaProxy(domain) {
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent('https://' + domain)}&timestamp=${Date.now()}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return { ok: false, httpCode: null };
    const json = await res.json();
    const code = Number(json?.status?.http_code ?? 0);
    return { ok: code > 0, httpCode: code };
  } catch {
    return { ok: false, httpCode: null };
  }
}

// ── Probe 3: <img> favicon ping ───────────────────────────────────────────────
// Browsers can load cross-origin images freely. We try to load a known static
// asset from the target domain. Resolves if DNS + TCP succeed; fails only on
// NXDOMAIN or a total network block.
async function probeFaviconPing(domain) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, 4000);
    img.onload  = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    // Use Google S2 favicon CDN as a reachability probe — it fetches the
    // target site's icon so its success indicates the domain is real.
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32&_=${Date.now()}`;
  });
}

// ── Main Multi-Signal Check ───────────────────────────────────────────────────
export async function checkWebsiteStatus(target) {
  const domain   = getHostname(target);
  const cleanKey = cleanDomainKey(target);

  // Run all probes + report fetch concurrently
  const [headR, proxyR, favR, reportsR] = await Promise.allSettled([
    probeDirectHead(domain),
    probeViaProxy(domain),
    probeFaviconPing(domain),
    fetchOutageReports(cleanKey)
  ]);

  const head    = headR.status    === 'fulfilled' ? headR.value    : { ok: false, latency: null };
  const proxy   = proxyR.status   === 'fulfilled' ? proxyR.value   : { ok: false, httpCode: null };
  const favicon = favR.status     === 'fulfilled' ? favR.value     : false;
  const reports = reportsR.status === 'fulfilled' ? reportsR.value : [];

  const successCount = [head.ok, proxy.ok, favicon].filter(Boolean).length;
  const latency = head.ok ? head.latency : null;

  // ── Verdict: majority vote (2/3 = online, 1/3 = degraded, 0/3 = down) ─────
  let status, message;

  if (successCount >= 2) {
    if (latency !== null && latency > 1500) {
      status  = 'Slow';
      message = 'Site is online but responding with elevated latency.';
    } else {
      status  = 'Online';
      message = 'Site is fully reachable and responding normally.';
    }
  } else if (successCount === 1) {
    if (proxy.ok) {
      status  = 'Down for You';
      message = 'Site is globally reachable but failing from your local connection.';
    } else {
      status  = 'Slow';
      message = 'Site is partially reachable — possible degradation or maintenance.';
    }
  } else {
    status  = 'Outage';
    message = 'Website appears to be down — all reachability probes failed.';
  }

  // Override: very fast latency is unambiguous proof the site is up
  if (latency !== null && latency < 300 && status !== 'Online') {
    status  = 'Online';
    message = 'Site is reachable and responding quickly.';
  }

  return {
    domain,
    cleanKey,
    status,
    message,
    localLatency: latency,
    isGloballyReachable: proxy.ok,
    successCount,
    reportsCount: reports.length,
    reports
  };
}

// ── Outage Report Storage ─────────────────────────────────────────────────────
export async function fetchOutageReports(cleanKey) {
  const url       = `https://kvdb.io/${OUTAGE_KV_BUCKET}/outage_${cleanKey}`;
  const oneDayAgo = Date.now() - 86400000;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('kvdb');
    const text = await res.text();
    if (!text || !text.trim()) return [];
    return JSON.parse(text)
      .map(t => new Date(t).getTime())
      .filter(t => t > oneDayAgo);
  } catch {
    try {
      const raw = localStorage.getItem(`outages_${cleanKey}`);
      if (raw) {
        return JSON.parse(raw)
          .map(t => new Date(t).getTime())
          .filter(t => t > oneDayAgo);
      }
    } catch {}
  }
  return [];
}

export async function submitOutageReport(cleanKey) {
  const url       = `https://kvdb.io/${OUTAGE_KV_BUCKET}/outage_${cleanKey}`;
  const oneDayAgo = Date.now() - 86400000;

  let reports = await fetchOutageReports(cleanKey);
  reports.push(Date.now());
  reports = reports.filter(t => t > oneDayAgo);
  const isoStrings = reports.map(t => new Date(t).toISOString());

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isoStrings),
      signal: AbortSignal.timeout(4000)
    });
  } catch {}

  try { localStorage.setItem(`outages_${cleanKey}`, JSON.stringify(isoStrings)); } catch {}
  return reports;
}

// ── Chart Renderer ────────────────────────────────────────────────────────────
export function renderOutageChart(reports = [], containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const now     = Date.now();
  const hourMs  = 3600000;
  const bins    = Array(24).fill(0);
  reports.forEach(t => {
    const h = Math.floor((now - t) / hourMs);
    if (h >= 0 && h < 24) bins[23 - h]++;
  });

  const maxVal      = Math.max(...bins, 4);
  const chartH      = 120;
  const chartW      = container.clientWidth || 500;
  const barW        = Math.max(2, Math.floor(chartW / 24) - 4);

  const bars = bins.map((count, i) => {
    const bh = Math.max(2, Math.round((count / maxVal) * (chartH - 20)));
    const x  = i * (barW + 4) + 10;
    const y  = chartH - bh - 15;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2"
      fill="${i === 23 ? 'var(--cyan)' : 'var(--violet)'}"
      opacity="${count > 0 ? 1 : 0.2}" style="transition:all .5s ease;">
      <title>${23 - i}h ago: ${count} report(s)</title></rect>`;
  }).join('');

  container.innerHTML = `
    <svg width="100%" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="overflow:visible;">
      <line x1="0" y1="10" x2="${chartW}" y2="10" stroke="var(--border)" stroke-dasharray="4"/>
      <line x1="0" y1="${(chartH-15)/2}" x2="${chartW}" y2="${(chartH-15)/2}" stroke="var(--border)" stroke-dasharray="4" opacity=".5"/>
      <line x1="0" y1="${chartH-15}" x2="${chartW}" y2="${chartH-15}" stroke="var(--border)"/>
      ${bars}
      <text x="10" y="${chartH}" fill="var(--text-muted)" font-size="9">24h ago</text>
      <text x="${chartW/2}" y="${chartH}" fill="var(--text-muted)" font-size="9" text-anchor="middle">12h ago</text>
      <text x="${chartW-10}" y="${chartH}" fill="var(--text-muted)" font-size="9" text-anchor="end">Now</text>
    </svg>`;
}

// ── Popular Services Grid ─────────────────────────────────────────────────────
export function renderPopularGrid(containerId, onSelectCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = POPULAR_SERVICES.map((site, i) => `
    <div class="detector-card" id="popCard-${i}" data-domain="${site.domain}">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="pop-icon-wrap" style="background:${site.color}18;border:1px solid ${site.color}44;border-radius:8px;padding:5px;flex-shrink:0;">
          <img
            id="popIcon-${i}"
            src="https://www.google.com/s2/favicons?domain=${site.domain}&sz=64"
            alt="${site.name}"
            width="24" height="24"
            style="display:block;border-radius:3px;"
            onerror="this.onerror=null;this.src='https://icons.duckduckgo.com/ip3/${site.domain}.ico';"
          />
        </div>
        <div>
          <div style="font-size:0.85rem;font-weight:600;color:var(--text);">${site.name}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">${site.domain}</div>
        </div>
      </div>
      <div class="status-indicator">
        <span class="status-time" id="popTime-${i}">Checking…</span>
        <span class="status-dot status-dot-pulse bg-loading" id="popDot-${i}"></span>
      </div>
    </div>
  `).join('');

  POPULAR_SERVICES.forEach((site, i) => {
    const el = document.getElementById(`popCard-${i}`);
    if (el) el.addEventListener('click', () => {
      if (typeof onSelectCallback === 'function') onSelectCallback(site.domain);
    });
  });
}

// ── Grid Background Poller ────────────────────────────────────────────────────
// For the grid we use ONLY the direct no-cors HEAD probe.
// Rationale: HEAD with no-cors resolves iff the server responds at all.
// It only throws on actual network failure (NXDOMAIN, refused, timeout).
// This avoids false negatives from slow proxy APIs and is very fast.
async function pollSingleService(site, index) {
  const dot      = document.getElementById(`popDot-${index}`);
  const timeText = document.getElementById(`popTime-${index}`);
  if (!dot || !timeText) return;

  const { ok, latency } = await probeDirectHead(site.domain);

  dot.className = 'status-dot'; // reset animation class

  if (ok) {
    timeText.textContent = latency !== null ? `${latency} ms` : 'Online';
    dot.classList.add(latency > 1200 ? 'bg-warning' : 'bg-success');
  } else {
    // HEAD threw — do a final proxy check before painting red
    // Run it without awaiting on the first pass to not block the UI
    probeViaProxy(site.domain).then(({ ok: proxyOk }) => {
      const d = document.getElementById(`popDot-${index}`);
      const t = document.getElementById(`popTime-${index}`);
      if (!d || !t) return;
      d.className = 'status-dot';
      if (proxyOk) {
        t.textContent = 'Online';
        d.classList.add('bg-success');
      } else {
        t.textContent = 'No response';
        d.classList.add('bg-danger');
      }
    });

    // Show a neutral "checking" state while the proxy resolves
    timeText.textContent = 'Verifying…';
    dot.classList.add('bg-loading', 'status-dot-pulse');
  }
}

export function startBackgroundGridPoll() {
  if (pollIntervalId) clearInterval(pollIntervalId);

  const runPoll = () => {
    // Stagger each service poll by 400ms to avoid simultaneous requests
    POPULAR_SERVICES.forEach((site, i) => {
      setTimeout(() => pollSingleService(site, i), i * 400);
    });
  };

  runPoll();
  pollIntervalId = setInterval(runPoll, 35000);
}

export function stopBackgroundGridPoll() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}
