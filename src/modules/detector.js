import { measureLatencySingle } from '../tools/latency.js';

const OUTAGE_KV_BUCKET = 'sitescope_v4_history';
const POPULAR_SERVICES = [
  { name: 'Google', domain: 'google.com' },
  { name: 'YouTube', domain: 'youtube.com' },
  { name: 'GitHub', domain: 'github.com' },
  { name: 'Netflix', domain: 'netflix.com' },
  { name: 'OpenAI', domain: 'openai.com' },
  { name: 'Amazon', domain: 'amazon.com' }
];

let pollIntervalId = null;

// Helper to clean domain names for kvdb keys
function cleanDomainKey(urlOrDomain) {
  try {
    let hostname = urlOrDomain;
    if (/^https?:\/\//i.test(urlOrDomain)) {
      hostname = new URL(urlOrDomain).hostname;
    }
    return hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9._-]/g, '_');
  } catch {
    return urlOrDomain.replace(/[^a-z0-9._-]/g, '_');
  }
}

// Extract hostname for user display
function getHostname(urlOrDomain) {
  try {
    let hostname = urlOrDomain;
    if (/^https?:\/\//i.test(urlOrDomain)) {
      hostname = new URL(urlOrDomain).hostname;
    }
    return hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return urlOrDomain.toLowerCase();
  }
}

// ── Probe 1: Direct HEAD fetch with no-cors (measures RTT, always resolves) ──
// Returns { ok: boolean, latency: number|null }
async function probeDirectHead(domain) {
  const url = 'https://' + domain;
  const start = performance.now();
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    const latency = Math.round(performance.now() - start);
    // A no-cors fetch that resolves (even with opaque response) means
    // the server is reachable. If latency is suspiciously low (<5ms),
    // it may be served from service worker/cache — still counts as ok.
    return { ok: true, latency };
  } catch {
    // Network error or timeout — the server did NOT respond
    return { ok: false, latency: null };
  }
}

// ── Probe 2: DNS/reachability via multiple CORS proxies ──────────────────────
// Returns { ok: boolean, httpCode: number|null }
async function probeViaProxy(domain) {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent('https://' + domain)}&timestamp=${Date.now()}`,
    `https://corsproxy.io/?${encodeURIComponent('https://' + domain)}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;

      // allorigins returns JSON with status.http_code
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const json = await res.json();
          const code = json?.status?.http_code ?? json?.status ?? 0;
          if (code > 0) return { ok: true, httpCode: Number(code) };
        } catch { /* not JSON, try next */ }
      } else {
        // corsproxy.io returns the raw content; if we get a response it's reachable
        return { ok: true, httpCode: res.status };
      }
    } catch { /* timeout or network error, try next proxy */ }
  }
  return { ok: false, httpCode: null };
}

// ── Probe 3: Favicon/image probe — bypasses most CORS restrictions ────────────
// Google's favicon service returns a 1×1 placeholder even for unknown domains,
// but the request itself reveals DNS reachability.
async function probeFavicon(domain) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      img.src = '';
      resolve(false);
    }, 4000);

    // We ping the actual site favicon, not the Google proxy,
    // to test actual connectivity to the target domain.
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };

    // Use a well-known CDN-served resource (e.g., favicon.ico) at the root
    img.src = `https://${domain}/favicon.ico?_=${Date.now()}`;
  });
}

// ── Main Status Check (multi-signal, tolerant) ──────────────────────────────
export async function checkWebsiteStatus(target) {
  const domain = getHostname(target);
  const cleanKey = cleanDomainKey(target);

  // Run all probes + outage report fetch concurrently
  const [headResult, proxyResult, faviconResult, reportsResult] = await Promise.allSettled([
    probeDirectHead(domain),
    probeViaProxy(domain),
    probeFavicon(domain),
    fetchOutageReports(cleanKey)
  ]);

  const head    = headResult.status    === 'fulfilled' ? headResult.value    : { ok: false, latency: null };
  const proxy   = proxyResult.status   === 'fulfilled' ? proxyResult.value   : { ok: false, httpCode: null };
  const favicon = faviconResult.status === 'fulfilled' ? faviconResult.value : false;
  const reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];

  // Count how many independent probes say the site is up
  const successCount = [head.ok, proxy.ok, favicon].filter(Boolean).length;
  // Total probes that gave a definitive answer (not all timed out simultaneously)
  const totalProbes = 3;

  // Determine latency — only trust the direct HEAD latency if the probe succeeded
  const latency = head.ok ? head.latency : null;

  // ── Status Determination ──────────────────────────────────────
  // We use a majority-vote approach:
  //   ≥ 2/3 probes OK  →  site is up
  //   1/3 probes OK    →  partial / possibly slow for some users
  //   0/3 probes OK    →  likely down, but we cross-check proxy
  let status = 'Online';
  let message = 'Site is reachable and operating normally.';

  if (successCount === totalProbes) {
    // All 3 probes agree: site is up
    if (latency !== null && latency > 1500) {
      status = 'Slow';
      message = 'Site is online but responding with elevated latency.';
    } else {
      status = 'Online';
      message = 'Site is fully reachable and responding normally.';
    }
  } else if (successCount === 2) {
    // 2/3 probes agree: site is up (one probe may have failed due to CORS/firewall)
    if (latency !== null && latency > 1500) {
      status = 'Slow';
      message = 'Site is reachable but showing higher-than-normal response times.';
    } else {
      status = 'Online';
      message = 'Site appears to be online (2/3 reachability probes succeeded).';
    }
  } else if (successCount === 1) {
    // Only 1 probe succeeded — could be degraded or blocked for some users
    if (proxy.ok) {
      // Globally reachable but local probes failed
      status = 'Down for You';
      message = 'Site is globally reachable but failing from your local connection or ISP.';
    } else {
      // Only local or favicon succeeded — likely slow or partial outage
      status = 'Slow';
      message = 'Site is partially reachable — possible degradation or maintenance.';
    }
  } else {
    // 0/3 probes succeeded
    // Do a final check: are all probes timed out (which could mean WE have no internet)?
    // If head probe returned false but also no proxy reachability, likely a real outage
    status = 'Outage';
    message = 'Website appears to be down — all reachability probes failed to connect.';
  }

  // Special case: if latency is very fast (< 50ms), it's definitely up even if other probes failed
  // This handles cases where no-cors fetch resolves instantly from a CDN edge node
  if (latency !== null && latency < 200 && status !== 'Online') {
    status = 'Online';
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

// ── Outage Reports Persistence (kvdb.io + localStorage fallback) ─────────────
export async function fetchOutageReports(cleanKey) {
  const url = `https://kvdb.io/${OUTAGE_KV_BUCKET}/outage_${cleanKey}`;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('kvdb fetch failed');
    const text = await res.text();
    if (!text || text.trim() === '') return [];
    const timestamps = JSON.parse(text);
    if (Array.isArray(timestamps)) {
      return timestamps.map(t => new Date(t).getTime()).filter(t => t > oneDayAgo);
    }
  } catch {
    // LocalStorage fallback
    try {
      const localData = localStorage.getItem(`outages_${cleanKey}`);
      if (localData) {
        const timestamps = JSON.parse(localData);
        return timestamps.map(t => new Date(t).getTime()).filter(t => t > oneDayAgo);
      }
    } catch {}
  }
  return [];
}

export async function submitOutageReport(cleanKey) {
  const url = `https://kvdb.io/${OUTAGE_KV_BUCKET}/outage_${cleanKey}`;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let reports = await fetchOutageReports(cleanKey);
  reports.push(now);
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

  try {
    localStorage.setItem(`outages_${cleanKey}`, JSON.stringify(isoStrings));
  } catch {}

  return reports;
}

// ── UI Renderers ─────────────────────────────────────────────────────────────
export function renderOutageChart(reports = [], containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // Create 24 bins for the last 24 hours
  const bins = Array(24).fill(0);
  reports.forEach(t => {
    const hoursAgo = Math.floor((now - t) / hourMs);
    if (hoursAgo >= 0 && hoursAgo < 24) {
      bins[23 - hoursAgo]++;
    }
  });

  const maxVal = Math.max(...bins, 4);
  const chartHeight = 120;
  const chartWidth = container.clientWidth || 500;
  const barWidth = Math.max(2, Math.floor(chartWidth / 24) - 4);

  let barsHtml = '';
  bins.forEach((count, i) => {
    const barHeight = Math.max(2, Math.round((count / maxVal) * (chartHeight - 20)));
    const x = i * (barWidth + 4) + 10;
    const y = chartHeight - barHeight - 15;
    const isCurrentHour = i === 23;
    const fill = isCurrentHour ? 'var(--cyan)' : 'var(--violet)';
    const opacity = count > 0 ? 1.0 : 0.2;

    barsHtml += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2"
            fill="${fill}" opacity="${opacity}" style="transition: all 0.5s ease;">
        <title>${23 - i}h ago: ${count} report(s)</title>
      </rect>
    `;
  });

  const labelsHtml = `
    <text x="10" y="${chartHeight}" fill="var(--text-muted)" font-size="9">24h ago</text>
    <text x="${chartWidth / 2}" y="${chartHeight}" fill="var(--text-muted)" font-size="9" text-anchor="middle">12h ago</text>
    <text x="${chartWidth - 10}" y="${chartHeight}" fill="var(--text-muted)" font-size="9" text-anchor="end">Now</text>
  `;

  const gridLines = `
    <line x1="0" y1="10" x2="${chartWidth}" y2="10" stroke="var(--border)" stroke-dasharray="4" />
    <line x1="0" y1="${(chartHeight - 15) / 2}" x2="${chartWidth}" y2="${(chartHeight - 15) / 2}" stroke="var(--border)" stroke-dasharray="4" opacity="0.5" />
    <line x1="0" y1="${chartHeight - 15}" x2="${chartWidth}" y2="${chartHeight - 15}" stroke="var(--border)" />
  `;

  container.innerHTML = `
    <svg width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="overflow:visible;">
      ${gridLines}
      ${barsHtml}
      ${labelsHtml}
    </svg>
  `;
}

export function renderPopularGrid(containerId, onSelectCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cardsHtml = POPULAR_SERVICES.map((site, index) => {
    return `
      <div class="detector-card" id="popCard-${index}" data-domain="${site.domain}" style="cursor:pointer;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="https://www.google.com/s2/favicons?domain=${site.domain}&sz=32" alt="${site.name} Icon" width="20" height="20" style="border-radius:4px;" />
          <div>
            <div style="font-size:0.85rem;font-weight:600;color:var(--text);">${site.name}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${site.domain}</div>
          </div>
        </div>
        <div class="status-indicator">
          <span class="status-time" id="popTime-${index}">Checking…</span>
          <span class="status-dot status-dot-pulse bg-loading" id="popDot-${index}"></span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;

  POPULAR_SERVICES.forEach((site, index) => {
    const el = document.getElementById(`popCard-${index}`);
    if (el) {
      el.addEventListener('click', () => {
        if (typeof onSelectCallback === 'function') {
          onSelectCallback(site.domain);
        }
      });
    }
  });
}

// ── Background Grid Poller ────────────────────────────────────────────────────
// Uses only the fast direct HEAD probe for the grid cards — it's sufficient
// to distinguish "up" vs "down" for well-known services, and is much faster
// than the full multi-probe check. We only fall back to proxy if HEAD fails.
async function pollSingleService(site, index) {
  const dot = document.getElementById(`popDot-${index}`);
  const timeText = document.getElementById(`popTime-${index}`);
  if (!dot || !timeText) return;

  const { ok, latency } = await probeDirectHead(site.domain);

  dot.className = 'status-dot';

  if (ok && latency !== null) {
    timeText.textContent = `${latency} ms`;
    dot.classList.add(latency > 1200 ? 'bg-warning' : 'bg-success');
  } else {
    // HEAD probe failed — do a quick proxy check before marking as down
    const { ok: proxyOk } = await probeViaProxy(site.domain);
    if (proxyOk) {
      // Globally reachable but HEAD failed (CORS block from local network)
      timeText.textContent = 'Online';
      dot.classList.add('bg-success');
    } else {
      timeText.textContent = 'Outage?';
      dot.classList.add('bg-danger');
    }
  }
}

export function startBackgroundGridPoll() {
  if (pollIntervalId) clearInterval(pollIntervalId);

  const runPoll = () => {
    // Stagger polls by 300ms each to avoid hammering all at once
    POPULAR_SERVICES.forEach((site, index) => {
      setTimeout(() => pollSingleService(site, index), index * 300);
    });
  };

  runPoll(); // run immediately
  pollIntervalId = setInterval(runPoll, 30000); // refresh every 30 seconds
}

export function stopBackgroundGridPoll() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}
