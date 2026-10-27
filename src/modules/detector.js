// @ts-check
// ── detector.js — Reliable Down Detection via Official APIs + DNS-over-HTTPS ──
// Strategy:
//   Tier 1 (popular services with official Statuspage.io): query the service's
//           own status API — authoritative, CORS-friendly, zero false positives.
//   Tier 2 (all other domains): DNS-over-HTTPS (dns.google) + allorigins proxy
//           run in parallel, majority-vote verdict.

import { logWarn } from '../utils/logger.js';

/**
 * @typedef {{ name:string, domain:string, color:string, statusApi:string|null, statusPage:string|null }} ServiceEntry
 * @typedef {{ status:string, cssClass:string, badgeClass:string }} StatusMapping
 * @typedef {{ domain:string, cleanKey:string, status:string, message:string, source:'official'|'probe',
 *   officialDescription?:string, localLatency:number|null, isGloballyReachable:boolean,
 *   reportsCount:number, reports:number[] }} WebsiteStatusResult
 */

const OUTAGE_KV_BUCKET = 'sitescope_v4_history';

// ── Service registry ──────────────────────────────────────────────────────────
// statusApi: Atlassian Statuspage v2 endpoint (returns { status: { indicator } })
//   indicator values: "none" | "minor" | "major" | "critical"
// statusPage: link to human-readable status page (shown in UI)
const POPULAR_SERVICES = [
  {
    name: 'GitHub',
    domain: 'github.com',
    color: '#8b5cf6',
    statusApi: 'https://www.githubstatus.com/api/v2/status.json',
    statusPage: 'https://www.githubstatus.com'
  },
  {
    name: 'OpenAI',
    domain: 'openai.com',
    color: '#10a37f',
    statusApi: 'https://status.openai.com/api/v2/status.json',
    statusPage: 'https://status.openai.com'
  },
  {
    name: 'Discord',
    domain: 'discord.com',
    color: '#5865F2',
    statusApi: 'https://discordstatus.com/api/v2/status.json',
    statusPage: 'https://discordstatus.com'
  },
  {
    name: 'Cloudflare',
    domain: 'cloudflare.com',
    color: '#F38020',
    statusApi: 'https://www.cloudflarestatus.com/api/v2/status.json',
    statusPage: 'https://www.cloudflarestatus.com'
  },
  {
    name: 'Google',
    domain: 'google.com',
    color: '#4285F4',
    statusApi: null,
    statusPage: 'https://www.google.com/appsstatus/'
  },
  {
    name: 'YouTube',
    domain: 'youtube.com',
    color: '#FF0000',
    statusApi: null,
    statusPage: null
  },
  {
    name: 'Netflix',
    domain: 'netflix.com',
    color: '#E50914',
    statusApi: null,
    statusPage: 'https://help.netflix.com/en/is-netflix-down'
  },
  {
    name: 'Amazon',
    domain: 'amazon.com',
    color: '#FF9900',
    statusApi: null,
    statusPage: null
  },
  {
    name: 'X / Twitter',
    domain: 'x.com',
    color: '#1DA1F2',
    statusApi: null,
    statusPage: null
  },
];

/** @type {ReturnType<typeof setInterval> | null} */
let pollIntervalId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Normalize a URL or bare domain into a filesystem/key-safe identifier
 * (lowercase, no scheme, no `www.`, non key-safe chars replaced with `_`).
 * @param {string} urlOrDomain
 * @returns {string}
 */
export function cleanDomainKey(urlOrDomain) {
  try {
    let h = urlOrDomain;
    if (/^https?:\/\//i.test(h)) h = new URL(h).hostname;
    return h.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9._-]/g, '_');
  } catch {
    return urlOrDomain.replace(/[^a-z0-9._-]/g, '_');
  }
}

/**
 * Extract a lowercase hostname (no scheme, no `www.`) from a URL or bare domain.
 * @param {string} urlOrDomain
 * @returns {string}
 */
export function getHostname(urlOrDomain) {
  try {
    let h = urlOrDomain;
    if (/^https?:\/\//i.test(h)) h = new URL(h).hostname;
    return h.toLowerCase().replace(/^www\./, '');
  } catch {
    return urlOrDomain.toLowerCase();
  }
}

/**
 * Find a well-known service entry whose domain matches or is a parent of
 * the given domain.
 * @param {string} domain
 * @returns {ServiceEntry | null}
 */
export function findServiceByDomain(domain) {
  return POPULAR_SERVICES.find(s => s.domain === domain || domain.endsWith(`.${s.domain}`)) || null;
}

// ── Tier 1: Official Statuspage API ──────────────────────────────────────────
// Returns { status, description, source: 'official' } or null on failure
async function fetchStatusPageApi(apiUrl) {
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const indicator = json?.status?.indicator ?? 'unknown';
    const description = json?.status?.description ?? '';
    return { indicator, description, source: 'official' };
  } catch {
    return null;
  }
}

/**
 * Maps a Statuspage.io indicator value to our internal status labels/CSS classes.
 * @param {string} indicator - 'none' | 'minor' | 'major' | 'critical' | other
 * @returns {StatusMapping}
 */
export function indicatorToStatus(indicator) {
  switch (indicator) {
    case 'none':     return { status: 'Online',  cssClass: 'verdict-online', badgeClass: 'badge-online' };
    case 'minor':    return { status: 'Degraded', cssClass: 'verdict-slow',   badgeClass: 'badge-slow' };
    case 'major':    return { status: 'Outage',  cssClass: 'verdict-down',   badgeClass: 'badge-down' };
    case 'critical': return { status: 'Outage',  cssClass: 'verdict-down',   badgeClass: 'badge-down' };
    default:         return { status: 'Unknown', cssClass: '',                badgeClass: 'badge-slow' };
  }
}

// ── Tier 2a: DNS-over-HTTPS (Google Public DNS) ───────────────────────────────
// Fully CORS-accessible. Status 0 = NOERROR, 3 = NXDOMAIN.
// An A record in the Answer array means DNS resolves → domain is reachable.
async function checkDnsOverHttps(domain) {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!res.ok) return { resolves: false };
    const json = await res.json();
    // Status 0 = NOERROR, Answer array present = domain has A records
    const resolves = json.Status === 0 && Array.isArray(json.Answer) && json.Answer.length > 0;
    const ip = resolves ? json.Answer[0]?.data : null;
    return { resolves, ip };
  } catch {
    return { resolves: false, ip: null };
  }
}

// ── Tier 2b: allorigins CORS proxy ───────────────────────────────────────────
// Checks if the site responds over HTTP from an external server.
async function checkViaProxy(domain) {
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://${domain}`)}&timestamp=${Date.now()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { ok: false };
    const json = await res.json();
    const code = Number(json?.status?.http_code ?? 0);
    return { ok: code > 0, httpCode: code };
  } catch {
    return { ok: false, httpCode: null };
  }
}

// ── Tier 2c: Direct no-cors HEAD (fastest local signal) ──────────────────────
// With mode:'no-cors' the fetch ONLY throws on true network failure
// (NXDOMAIN, TCP refused, timeout). A 4xx/5xx from the server still resolves.
// So: resolves = server exists, throws = unreachable.
async function checkDirectHead(domain) {
  const start = performance.now();
  try {
    await fetch(`https://${domain}`, {
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

// ── Main Status Check ─────────────────────────────────────────────────────────
/**
 * @param {string} target - a URL or bare domain to check
 * @returns {Promise<WebsiteStatusResult>}
 */
export async function checkWebsiteStatus(target) {
  const domain   = getHostname(target);
  const cleanKey = cleanDomainKey(target);
  const service  = findServiceByDomain(domain);

  // Try official status API first if available
  if (service?.statusApi) {
    const [apiResult, reportsResult] = await Promise.allSettled([
      fetchStatusPageApi(service.statusApi),
      fetchOutageReports(cleanKey)
    ]);

    const api     = apiResult.status === 'fulfilled' ? apiResult.value : null;
    const reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];

    if (api) {
      const mapped = indicatorToStatus(api.indicator);
      return {
        domain,
        cleanKey,
        status: mapped.status,
        message: api.description || `Status: ${api.indicator}`,
        source: 'official',
        officialDescription: api.description,
        localLatency: null,
        isGloballyReachable: api.indicator === 'none',
        reportsCount: reports.length,
        reports
      };
    }
    // Fall through to Tier 2 if API call failed
  }

  // Tier 2: DNS + proxy + direct HEAD in parallel
  const [dnsResult, proxyResult, headResult, reportsResult] = await Promise.allSettled([
    checkDnsOverHttps(domain),
    checkViaProxy(domain),
    checkDirectHead(domain),
    fetchOutageReports(cleanKey)
  ]);

  const dns     = dnsResult.status     === 'fulfilled' ? dnsResult.value     : { resolves: false };
  const proxy   = proxyResult.status   === 'fulfilled' ? proxyResult.value   : { ok: false };
  const head    = headResult.status    === 'fulfilled' ? headResult.value    : { ok: false, latency: null };
  const reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];

  // Count positive signals
  const signals = [dns.resolves, proxy.ok, head.ok].filter(Boolean).length;
  const latency = head.ok ? head.latency : null;

  let status, message;

  if (signals >= 2) {
    if (latency !== null && latency > 1500) {
      status  = 'Slow';
      message = 'Site is online but responding with elevated latency.';
    } else {
      status  = 'Online';
      message = 'Site is reachable — DNS resolves and server responds normally.';
    }
  } else if (signals === 1) {
    if (dns.resolves && !proxy.ok) {
      status  = 'Down for You';
      message = 'DNS resolves correctly but server is not responding — may be a local or ISP issue.';
    } else if (!dns.resolves && proxy.ok) {
      status  = 'Slow';
      message = 'Server responded via proxy but DNS is unstable — possible degradation.';
    } else {
      status  = 'Slow';
      message = 'Partially reachable — site may be experiencing intermittent issues.';
    }
  } else {
    // All 3 failed
    if (!dns.resolves) {
      status  = 'Outage';
      message = 'DNS lookup failed — domain is not resolving. Site is likely down globally.';
    } else {
      status  = 'Outage';
      message = 'All reachability probes failed — site appears to be unreachable.';
    }
  }

  // Strong override: if HEAD is very fast, site is definitely up
  if (latency !== null && latency < 300) {
    status  = 'Online';
    message = 'Site is reachable and responding quickly.';
  }

  return {
    domain,
    cleanKey,
    status,
    message,
    source: 'probe',
    localLatency: latency,
    isGloballyReachable: proxy.ok || dns.resolves,
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
    return JSON.parse(text).map(t => new Date(t).getTime()).filter(t => t > oneDayAgo);
  } catch (err) {
    logWarn('detector:fetchOutageReports:kvdb', err);
    try {
      const raw = localStorage.getItem(`outages_${cleanKey}`);
      if (raw) return JSON.parse(raw).map(t => new Date(t).getTime()).filter(t => t > oneDayAgo);
    } catch (localErr) {
      logWarn('detector:fetchOutageReports:localStorage', localErr);
    }
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
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isoStrings), signal: AbortSignal.timeout(4000) });
  } catch (err) {
    logWarn('detector:submitOutageReport:kvdb', err);
  }
  try {
    localStorage.setItem(`outages_${cleanKey}`, JSON.stringify(isoStrings));
  } catch (err) {
    logWarn('detector:submitOutageReport:localStorage', err);
  }
  return reports;
}

// ── Chart Renderer ────────────────────────────────────────────────────────────
export function renderOutageChart(reports = [], containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const now = Date.now();
  const bins = Array(24).fill(0);
  reports.forEach(t => {
    const h = Math.floor((now - t) / 3600000);
    if (h >= 0 && h < 24) bins[23 - h]++;
  });
  const maxVal = Math.max(...bins, 4);
  const H = 120, W = container.clientWidth || 500;
  const bw = Math.max(2, Math.floor(W / 24) - 4);
  const bars = bins.map((c, i) => {
    const bh = Math.max(2, Math.round((c / maxVal) * (H - 20)));
    return `<rect x="${i*(bw+4)+10}" y="${H-bh-15}" width="${bw}" height="${bh}" rx="2"
      fill="${i===23?'var(--cyan)':'var(--violet)'}" opacity="${c>0?1:0.2}" style="transition:all .5s">
      <title>${23-i}h ago: ${c} report(s)</title></rect>`;
  }).join('');
  container.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">
    <line x1="0" y1="10" x2="${W}" y2="10" stroke="var(--border)" stroke-dasharray="4"/>
    <line x1="0" y1="${(H-15)/2}" x2="${W}" y2="${(H-15)/2}" stroke="var(--border)" stroke-dasharray="4" opacity=".5"/>
    <line x1="0" y1="${H-15}" x2="${W}" y2="${H-15}" stroke="var(--border)"/>
    ${bars}
    <text x="10" y="${H}" fill="var(--text-muted)" font-size="9">24h ago</text>
    <text x="${W/2}" y="${H}" fill="var(--text-muted)" font-size="9" text-anchor="middle">12h ago</text>
    <text x="${W-10}" y="${H}" fill="var(--text-muted)" font-size="9" text-anchor="end">Now</text>
  </svg>`;
}

// ── Popular Services Grid ─────────────────────────────────────────────────────
// Icon strategy: render a coloured letter-avatar SVG immediately (zero network,
// never broken), then asynchronously try three logo sources in order:
//   1. Clearbit Logo API   — high-quality logos for major companies
//   2. Google S2 Favicons  — reliable favicon CDN
//   3. (keep letter avatar if both fail)
function makeLetterAvatar(letter, bgColor) {
  // Sanitise so it's safe to embed inside an SVG attribute
  const safeLetter = (letter || '?').toUpperCase().replace(/[^A-Z0-9]/g, '?')[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="${bgColor}"/>
    <text x="12" y="17.5" font-family="Inter,Arial,sans-serif" font-size="13"
          font-weight="700" text-anchor="middle" fill="#fff">${safeLetter}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function renderPopularGrid(containerId, onSelectCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = POPULAR_SERVICES.map((s, i) => {
    const avatarSrc = makeLetterAvatar(s.name[0], s.color);
    return `
      <div class="detector-card" id="popCard-${i}" data-domain="${s.domain}">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="pop-icon-wrap" style="background:${s.color}18;border:1px solid ${s.color}40;border-radius:8px;padding:6px;flex-shrink:0;">
            <img
              id="popIcon-${i}"
              src="${avatarSrc}"
              alt="${s.name}"
              width="24" height="24"
              style="display:block;border-radius:3px;"
            />
          </div>
          <div>
            <div style="font-size:0.84rem;font-weight:600;color:var(--text);white-space:nowrap;">${s.name}</div>
            <div style="font-size:0.66rem;color:var(--text-muted);">${s.statusApi ? '⚡ Official API' : '🔍 DNS probe'}</div>
          </div>
        </div>
        <div class="status-indicator">
          <span class="status-time" id="popTime-${i}">Checking…</span>
          <span class="status-dot status-dot-pulse bg-loading" id="popDot-${i}"></span>
        </div>
      </div>
    `;
  }).join('');

  // Click handlers
  POPULAR_SERVICES.forEach((s, i) => {
    const el = document.getElementById(`popCard-${i}`);
    if (el) el.addEventListener('click', () => {
      if (typeof onSelectCallback === 'function') onSelectCallback(s.domain);
    });
  });

  // Async icon loader — tries real logos after cards are painted.
  // Uses a chain: Clearbit → Google S2 → keep letter avatar (never errors).
  POPULAR_SERVICES.forEach((s, i) => {
    const imgEl = /** @type {HTMLImageElement} */ (document.getElementById(`popIcon-${i}`));
    if (!imgEl) return;

    const tryLoad = (src, nextSrc) => {
      const probe = new Image();
      probe.onload = () => {
        // Only swap if the image has real dimensions (guards against 1×1 error images)
        if (probe.naturalWidth > 4 && probe.naturalHeight > 4) {
          imgEl.src = probe.src;
        } else if (nextSrc) {
          tryLoad(nextSrc, null);
        }
      };
      probe.onerror = () => {
        if (nextSrc) tryLoad(nextSrc, null);
        // else keep letter avatar — imgEl.src already set
      };
      probe.src = src;
    };

    const clearbit = `https://logo.clearbit.com/${s.domain}`;
    const googleS2 = `https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`;
    tryLoad(clearbit, googleS2);
  });
}


// ── Grid Background Poller ────────────────────────────────────────────────────
async function pollSingleService(service, index) {
  const dot      = document.getElementById(`popDot-${index}`);
  const timeText = document.getElementById(`popTime-${index}`);
  if (!dot || !timeText) return;

  dot.className = 'status-dot status-dot-pulse bg-loading';
  timeText.textContent = '…';

  if (service.statusApi) {
    // ── Tier 1: Official Statuspage API ──────────────────────────────────────
    const api = await fetchStatusPageApi(service.statusApi);
    dot.className = 'status-dot';

    if (api) {
      timeText.textContent = api.indicator === 'none' ? 'Operational' :
                             api.indicator === 'minor' ? 'Degraded' : 'Outage';
      dot.classList.add(
        api.indicator === 'none'     ? 'bg-success' :
        api.indicator === 'minor'    ? 'bg-warning'  : 'bg-danger'
      );
    } else {
      // API call failed — fall back to DNS check
      const dns = await checkDnsOverHttps(service.domain);
      dot.className = 'status-dot';
      timeText.textContent = dns.resolves ? 'Online' : 'No response';
      dot.classList.add(dns.resolves ? 'bg-success' : 'bg-danger');
    }
  } else {
    // ── Tier 2: DNS-over-HTTPS + direct HEAD in parallel ────────────────────
    const [dnsResult, headResult] = await Promise.allSettled([
      checkDnsOverHttps(service.domain),
      checkDirectHead(service.domain)
    ]);

    const dns  = dnsResult.status  === 'fulfilled' ? dnsResult.value  : { resolves: false };
    const head = headResult.status === 'fulfilled' ? headResult.value : { ok: false, latency: null };

    dot.className = 'status-dot';

    if (head.ok && head.latency !== null) {
      // Direct HEAD succeeded — server is up
      timeText.textContent = `${head.latency} ms`;
      dot.classList.add(head.latency > 1200 ? 'bg-warning' : 'bg-success');
    } else if (dns.resolves) {
      // DNS resolves but HEAD failed (CORS block or CDN quirk) → likely online
      timeText.textContent = 'Online';
      dot.classList.add('bg-success');
    } else {
      // Both failed — do a final proxy check before going red
      const proxy = await checkViaProxy(service.domain);
      dot.className = 'status-dot';
      if (proxy.ok) {
        timeText.textContent = 'Online';
        dot.classList.add('bg-success');
      } else {
        timeText.textContent = 'No response';
        dot.classList.add('bg-danger');
      }
    }
  }
}

export function startBackgroundGridPoll() {
  if (pollIntervalId) clearInterval(pollIntervalId);
  const runPoll = () => {
    POPULAR_SERVICES.forEach((s, i) => setTimeout(() => pollSingleService(s, i), i * 500));
  };
  runPoll();
  pollIntervalId = setInterval(runPoll, 40000);
}

export function stopBackgroundGridPoll() {
  if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
}
