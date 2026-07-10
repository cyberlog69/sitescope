import { fetchWhois, fetchHttpHeaders } from './intel.js';
import { classifySite, CATEGORIES } from './modules/category.js';
import { scanSecurity, heuristicScan, THREAT_META } from './modules/security.js';
import { sanitizeForSandbox } from './modules/sandbox.js';
import { checkEmail, isValidEmailFormat, emailScoreFillCls, EMAIL_VERDICT } from './modules/email.js';
import { fetchAllDns, renderDnsPanel } from './tools/dns.js';
import { fetchSslInfo, renderSslPanel } from './tools/ssl.js';
import { detectTechnologies, renderStackPanel } from './tools/stack.js';
import { fetchRobotsTxt, parseRobotsTxt, renderRobotsPanel } from './tools/robots.js';
import { runLatencySuite, renderLatencyPanel } from './tools/latency.js';

/* ════════════════════════════════════════════════════════════
   SiteScope — app.js (Modularized)
   Fetches metadata + screenshot via Microlink API (free tier)
   and renders them in the UI.
   ════════════════════════════════════════════════════════════ */

'use strict';

// ── DOM References ──────────────────────────────────────────
const urlInput       = document.getElementById('urlInput');
const checkBtn       = document.getElementById('checkBtn');
const btnText        = document.getElementById('btnText');
const btnLoader      = document.getElementById('btnLoader');
const clearBtn       = document.getElementById('clearBtn');
const errorBanner    = document.getElementById('errorBanner');
const errorMsg       = document.getElementById('errorMsg');
const results        = document.getElementById('results');

// Info bar
const resultUrlText  = document.getElementById('resultUrlText');
const statusDot      = document.getElementById('statusDot');
const openBtn        = document.getElementById('openBtn');

// Preview
const tabScreenshot  = document.getElementById('tabScreenshot');
const tabLive        = document.getElementById('tabLive');
const screenshotView = document.getElementById('screenshotView');
const liveView       = document.getElementById('liveView');
const screenshotImg  = document.getElementById('screenshotImg');
const screenshotLoading = document.getElementById('screenshotLoading');
const screenshotError   = document.getElementById('screenshotError');
const browserAddress    = document.getElementById('browserAddress');
const iframeAddress     = document.getElementById('iframeAddress');
const siteFrame         = document.getElementById('siteFrame');

// Info panel
const siteFavicon    = document.getElementById('siteFavicon');
const faviconFallback= document.getElementById('faviconFallback');
const siteTitle      = document.getElementById('siteTitle');
const siteDomain     = document.getElementById('siteDomain');
const siteDescription= document.getElementById('siteDescription');
const metaStatus     = document.getElementById('metaStatus');
const metaAuthor     = document.getElementById('metaAuthor');
const metaLang       = document.getElementById('metaLang');
const metaProtocol   = document.getElementById('metaProtocol');
const ogSection      = document.getElementById('ogSection');
const ogImage        = document.getElementById('ogImage');
const keywordsSection= document.getElementById('keywordsSection');
const tagsWrap       = document.getElementById('tagsWrap');

// Category
const categoryBadge  = document.getElementById('categoryBadge');
const catIcon        = document.getElementById('catIcon');
const catLabel       = document.getElementById('catLabel');
const catDescription = document.getElementById('catDescription');

// ── State ───────────────────────────────────────────────────
let currentUrl = '';
let isLoading  = false;
let cachedHtml = '';
let cachedHtmlUrl = '';
let proxyFetchPromise = null;

// ── Helpers ─────────────────────────────────────────────────
function normalizeUrl(raw) {
  raw = raw.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { return new URL(raw).href; }
  catch { return null; }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function setLoading(state) {
  isLoading = state;
  checkBtn.disabled = state;
  if (state) { hide(btnText); show(btnLoader); }
  else { show(btnText); hide(btnLoader); }
}

function showError(msg) {
  errorMsg.textContent = msg;
  show(errorBanner);
}

function hideError() {
  hide(errorBanner);
}

function resetResults() {
  // Screenshot state
  show(screenshotLoading);
  hide(screenshotImg);
  hide(screenshotError);
  screenshotImg.src = '';

  // Info panel defaults
  siteTitle.textContent   = 'Loading\u2026';
  siteDomain.textContent  = '';
  siteDescription.textContent = 'Fetching site information\u2026';
  metaAuthor.textContent  = '\u2014';
  metaLang.textContent    = '\u2014';
  metaProtocol.textContent= '\u2014';
  metaStatus.innerHTML    = '<span class="badge badge-loading">Checking\u2026</span>';
  hide(faviconFallback);
  hide(siteFavicon);
  siteFavicon.src = '';
  hide(ogSection);
  ogImage.src = '';
  hide(keywordsSection);
  tagsWrap.innerHTML = '';
  siteFrame.src = '';
  // Reset category
  categoryBadge.className = 'category-badge category-loading';
  catIcon.textContent = '\u2026';
  catLabel.textContent = 'Detecting\u2026';
  catDescription.textContent = '';
  // Reset security
  resetSecurityPanel();
  // Reset sandbox
  resetSandboxPanel();
  // Switch to screenshot tab
  activateTab('screenshot');

  // Reset Advanced Intel Panel
  const advPanel = document.getElementById('advancedIntelPanel');
  if (advPanel) {
    advPanel.classList.add('hidden');
    // reset tabs to WHOIS active
    const tabs = document.querySelectorAll('#advancedIntelTabs .tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    if (tabs[0]) tabs[0].classList.add('active');
    
    document.querySelectorAll('.intel-tab-content').forEach(c => c.classList.add('hidden'));
    show(document.getElementById('intelTabWhois'));
    
    document.getElementById('intelWhois').textContent = 'Fetching WHOIS...';
    document.getElementById('intelHeaders').textContent = 'Fetching headers...';
    document.getElementById('intelDns').textContent = 'Fetching DNS...';
    document.getElementById('intelSsl').textContent = 'Fetching SSL...';
    document.getElementById('intelStack').textContent = 'Detecting technologies...';
    document.getElementById('intelRobots').textContent = 'Analyzing robots.txt...';
    document.getElementById('intelLatency').textContent = 'Measuring latency...';
  }
}

// ── Tab Switching ───────────────────────────────────────────
const tabSandbox   = document.getElementById('tabSandbox');
const sandboxView  = document.getElementById('sandboxView');

function activateTab(tab) {
  // Reset all tabs
  tabScreenshot.classList.remove('active');
  tabSandbox.classList.remove('active');
  tabLive.classList.remove('active');
  hide(screenshotView);
  hide(sandboxView);
  hide(liveView);

  if (tab === 'screenshot') {
    tabScreenshot.classList.add('active');
    show(screenshotView);
  } else if (tab === 'sandbox') {
    tabSandbox.classList.add('active');
    show(sandboxView);
    if (currentUrl) loadSandbox(currentUrl);
  } else {
    // live (unsafe)
    tabLive.classList.add('active');
    show(liveView);
    if (currentUrl && siteFrame.src !== currentUrl) {
      siteFrame.src = currentUrl;
      iframeAddress.textContent = currentUrl;
    }
  }
}

tabScreenshot.addEventListener('click', () => activateTab('screenshot'));
tabSandbox.addEventListener('click',    () => activateTab('sandbox'));
tabLive.addEventListener('click',       () => activateTab('live'));

// ── Input Clear ─────────────────────────────────────────────
urlInput.addEventListener('input', () => {
  if (urlInput.value.trim()) {
    clearBtn.classList.add('visible');
  } else {
    clearBtn.classList.remove('visible');
  }
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  clearBtn.classList.remove('visible');
  urlInput.focus();
});

// ── Quick Links ─────────────────────────────────────────────
document.querySelectorAll('.quick-btn:not([data-email])').forEach(btn => {
  btn.addEventListener('click', () => {
    urlInput.value = btn.dataset.url;
    clearBtn.classList.add('visible');
    urlInput.focus();
    checkSite(btn.dataset.url);
  });
});

// ── Open Button ─────────────────────────────────────────────
openBtn.addEventListener('click', () => {
  if (currentUrl) window.open(currentUrl, '_blank', 'noopener');
});

// ── Enter key ───────────────────────────────────────────────
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !isLoading) {
    triggerCheck();
  }
});

checkBtn.addEventListener('click', triggerCheck);

function triggerCheck() {
  const raw = urlInput.value;
  const url = normalizeUrl(raw);
  if (!url) {
    showError('Please enter a valid URL (e.g. https://example.com).');
    urlInput.focus();
    return;
  }
  urlInput.value = url;
  checkSite(url);
}

// ── Main Check Function ─────────────────────────────────────
async function checkSite(url) {
  if (isLoading) return;
  hideError();
  setLoading(true);

  currentUrl = url;
  const domain = getDomain(url);

  // Show results immediately with loading state
  show(results);
  resetResults();

  resultUrlText.textContent = url;
  browserAddress.textContent = url;
  siteDomain.textContent = domain;

  // Favicon
  loadFavicon(url, domain);

  // Protocol badge
  try {
    const proto = new URL(url).protocol.replace(':', '').toUpperCase();
    metaProtocol.textContent = proto;
  } catch {}

  // ── Kick off screenshot immediately via free thumbnail APIs
  loadScreenshotWaterfall(url);

  // ── Kick off raw HTML proxy fetch for sandbox caching & stack detection ──
  cachedHtml = '';
  cachedHtmlUrl = url;
  proxyFetchPromise = fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { headers: { Accept: 'application/json' } })
    .then(res => {
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      return res.json();
    })
    .catch(() => null);

  // ── Run metadata + reachability in parallel ──────────────────────────────────
  const [metaResult, reachable] = await Promise.allSettled([
    fetchSiteMeta(url),
    probeSiteReachability(url)
  ]);

  setLoading(false);

  const isReachable = reachable.status === 'fulfilled' && reachable.value === true;
  const meta = metaResult.status === 'fulfilled' ? metaResult.value : null;

  // ── Populate metadata ─────────────────────────────────────────────────────────
  const title = meta?.title || meta?.publisher || domain;
  const desc  = meta?.description || meta?.author || null;

  siteTitle.textContent = title || domain;
  siteDescription.textContent = desc || `No description metadata found for ${domain}.`;
  if (meta?.author) metaAuthor.textContent = meta.author;
  if (meta?.lang)   metaLang.textContent = meta.lang.toUpperCase();

  // OG image
  if (meta?.image?.url) {
    show(ogSection);
    ogImage.src = meta.image.url;
    ogImage.onerror = () => hide(ogSection);
  }

  // Tags
  const tags = meta?.keywords || meta?.tags;
  if (tags && tags.length) renderTags(tags);

  // ── Category, security, intel ─────────────────────────────────────────────────
  renderCategory(url, title, desc || '');
  
  const scanPromise = scanSecurity(url).then(merged => {
    renderSecurityReport(merged, 'done');
    hide(secScanningBadge);
    
    // Save Cloud History
    if (typeof saveCloudHistory === 'function') {
      saveCloudHistory(url, title, `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`, merged.level);
    }
  });

  // ── Status badge ──────────────────────────────────────────────────────────────
  const siteReachable = isReachable || meta !== null;

  if (siteReachable) {
    statusDot.style.background = '#22c55e';
    statusDot.style.boxShadow  = '0 0 8px #22c55e';
    metaStatus.innerHTML = `<span class="badge badge-ok">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Reachable
    </span>`;

    // Show Advanced Intel Panel
    const advPanel = document.getElementById('advancedIntelPanel');
    if (advPanel) advPanel.classList.remove('hidden');

    // Run basic WHOIS/Headers legacy check
    if (typeof fetchIpIntel === 'function') fetchIpIntel(domain);
    fetchWhois(domain);
    fetchHttpHeaders(domain);
    if (typeof renderQrCode === 'function') renderQrCode(url);

    // DNS Resolver
    const dnsContainer = document.getElementById('intelDns');
    if (dnsContainer) {
      dnsContainer.innerHTML = '<div class="info-value">Fetching DNS records...</div>';
      fetchAllDns(domain).then(dnsData => {
        renderDnsPanel(dnsData, dnsContainer);
      });
    }

    // SSL Inspector
    const sslContainer = document.getElementById('intelSsl');
    if (sslContainer) {
      sslContainer.innerHTML = '<div class="info-value">Fetching SSL details...</div>';
      fetchSslInfo(domain).then(sslData => {
        renderSslPanel(sslData, domain, sslContainer);
      });
    }

    // Tech Stack Fingerprinting (uses cached HTML proxy fetch)
    const stackContainer = document.getElementById('intelStack');
    if (stackContainer) {
      stackContainer.innerHTML = '<div class="info-value">Detecting technology fingerprint...</div>';
      proxyFetchPromise.then(json => {
        if (json && json.contents) {
          cachedHtml = json.contents;
          const detected = detectTechnologies(json.contents, {});
          renderStackPanel(detected, stackContainer);
        } else {
          stackContainer.innerHTML = '<div class="info-value">Technology detection unavailable (CORS/Proxy error).</div>';
        }
      });
    }

    // Robots.txt Analyzer
    const robotsContainer = document.getElementById('intelRobots');
    if (robotsContainer) {
      robotsContainer.innerHTML = '<div class="info-value">Analyzing robots.txt...</div>';
      fetchRobotsTxt(domain).then(robotsText => {
        const parsed = parseRobotsTxt(robotsText);
        renderRobotsPanel(parsed, robotsContainer);
      });
    }

    // Latency Probe
    const latencyContainer = document.getElementById('intelLatency');
    if (latencyContainer) {
      latencyContainer.innerHTML = '<div class="info-value">Measuring latency (5 HEAD trials)...</div>';
      runLatencySuite(url).then(trials => {
        renderLatencyPanel(trials, latencyContainer);
      });
    }

  } else {
    handleFetchError('Site could not be reached. It may be down, blocked, or require authentication.');
  }
}

// ── Fetch Site Metadata (Microlink) ──────────────────
async function fetchSiteMeta(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&video=false`;
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    const json = await res.json();
    if (json.status === 'success' || json.status === 'partial') {
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Probe Site Reachability (allorigins) ──────────────────────────────
async function probeSiteReachability(url) {
  try {
    const probeRes = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const json = await probeRes.json();
    return !!(json && json.status && json.status.http_code > 0);
  } catch {
    return false;
  }
}

// ── Screenshot ──────────────────────────────────────────────
function renderScreenshot(src) {
  hide(screenshotLoading);
  show(screenshotImg);
  screenshotImg.src = src;
  screenshotImg.onerror = showScreenshotError;
}

function showScreenshotError() {
  hide(screenshotLoading);
  hide(screenshotImg);
  show(screenshotError);
}

// ── Screenshot Waterfall ──────────────────────────────────────
function loadScreenshotWaterfall(url) {
  const enc = encodeURIComponent(url);
  const services = [
    `https://s0.wordpress.com/mshots/v1/${enc}?w=1200&h=800`,
    `https://image.thum.io/get/width/1200/crop/800/${url}`,
    `https://api.microlink.io/screenshot?url=${enc}&waitForTimeout=2000&type=jpeg&quality=85&viewport.width=1280&viewport.height=800`,
  ];

  let current = 0;

  function tryNext() {
    if (current >= services.length) {
      showScreenshotError();
      return;
    }
    const imgSrc = services[current++];
    const img = new Image();
    img.onload = () => {
      if (document.getElementById('screenshotView')) {
        renderScreenshot(imgSrc);
      }
    };
    img.onerror = () => {
      tryNext();
    };
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      tryNext();
    }, current === 1 ? 18000 : 10000);
    img.onload = () => {
      clearTimeout(timeout);
      renderScreenshot(imgSrc);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      tryNext();
    };
    img.src = imgSrc;
  }

  tryNext();
}

// ── Favicon ─────────────────────────────────────────────────
function loadFavicon(url, domain) {
  const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const fallback = `https://icon.horse/icon/${domain}`;

  siteFavicon.src = googleFavicon;
  siteFavicon.onload = () => {
    show(siteFavicon);
    hide(faviconFallback);
  };
  siteFavicon.onerror = () => {
    siteFavicon.src = fallback;
    siteFavicon.onload = () => {
      show(siteFavicon);
      hide(faviconFallback);
    };
    siteFavicon.onerror = () => {
      hide(siteFavicon);
      show(faviconFallback);
    };
  };
}

// ── Tags ────────────────────────────────────────────────────
function renderTags(tags) {
  if (!tags || !tags.length) return;
  const items = Array.isArray(tags) ? tags : tags.split(',');
  const cleaned = items
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 12);

  if (!cleaned.length) return;

  tagsWrap.innerHTML = cleaned
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');
  show(keywordsSection);
}

// ── Error State ─────────────────────────────────────────────
function handleFetchError(msg) {
  statusDot.style.background = '#ef4444';
  statusDot.style.boxShadow  = '0 0 8px #ef4444';
  metaStatus.innerHTML = `<span class="badge badge-err">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    Unreachable
  </span>`;
  siteTitle.textContent = getDomain(currentUrl);
  siteDescription.textContent = msg;
  showScreenshotError();
}

// ── Escape HTML ──────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Safe URL for href attributes ─────────────────────────────────────────────
function safeHref(url) {
  if (typeof url !== 'string') return '#';
  const t = url.trim();
  return (t.startsWith('https://') || t.startsWith('http://')) ? escapeHtml(t) : '#';
}

function renderCategory(url, title, description) {
  const { category: cat, confidence } = classifySite(url, title, description);

  categoryBadge.className = `category-badge ${cat.cssClass}`;
  catIcon.textContent  = cat.emoji;
  catLabel.textContent = cat.label;

  const confLabel =
      confidence === 'high'   ? '\u2713 High confidence'
    : confidence === 'medium' ? '\u007E Medium confidence'
    :                           '? Low confidence \u2014 may be approximate';

  catDescription.textContent = `${cat.description}  \u00B7  ${confLabel}`;
}

// ── DOM refs for security panel ─────────────────────────────
const securityReport    = document.getElementById('securityReport');
const secPlaceholder    = document.getElementById('secPlaceholder');
const secScanningBadge  = document.getElementById('secScanningBadge');

function resetSecurityPanel() {
  securityReport.innerHTML = `
    <div class="sec-placeholder" id="secPlaceholder">
      <div class="sk-line sk-w-60" style="height:32px;border-radius:8px;margin-bottom:10px"></div>
      <div class="sk-line sk-w-80" style="height:12px;border-radius:6px;margin-bottom:6px"></div>
      <div class="sk-line sk-w-50" style="height:12px;border-radius:6px"></div>
    </div>`;
  show(secScanningBadge);
}

function renderSecurityReport(report, stage) {
  const meta      = THREAT_META[report.level];
  const scoreDisp = Math.min(100, report.score);
  const fillCls   = `sec-fill-${report.level}`;

  const dbDot  = report.dbStatus === 'malware' ? 'sec-db-dot-malware'
               : report.dbStatus === 'clean'   ? 'sec-db-dot-clean'
               :                                 'sec-db-dot-unknown';
  const dbText = report.dbStatus === 'malware' ? 'Known threat — found in malware database'
               : report.dbStatus === 'clean'   ? 'Clean — not found in threat database'
               : report.dbStatus === 'pending' ? 'Checking threat databases\u2026'
               :                                 'Database check unavailable';

  const findingsHtml = report.findings.map(f => {
    const icons = {
      good:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`,
      warn:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      danger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    };
    return `<li class="sec-finding ${f.type}">
      <span class="sec-finding-icon">${icons[f.type] || icons.info}</span>
      <span>${escapeHtml(f.text)}</span>
    </li>`;
  }).join('');

  securityReport.innerHTML = `
    <!-- Threat level badge -->
    <div class="sec-threat-badge ${meta.secCls}">
      <span class="sec-threat-icon">${meta.icon}</span>
      <div class="sec-threat-info">
        <span class="sec-threat-level">${meta.label}</span>
        <span class="sec-threat-sub">${escapeHtml(meta.msg)}</span>
      </div>
      <span class="sec-risk-pill">${scoreDisp}</span>
    </div>

    <!-- Risk score bar -->
    <div class="sec-score-wrap">
      <div class="sec-score-label">
        <span>Risk Score</span>
        <span>${scoreDisp} / 100</span>
      </div>
      <div class="sec-score-track">
        <div class="sec-score-fill ${fillCls}" style="width:${scoreDisp}%"></div>
      </div>
    </div>

    <!-- DB status -->
    <div class="sec-db-row">
      <span class="sec-db-dot ${dbDot}"></span>
      <span style="color:var(--text-muted)">${escapeHtml(dbText)}</span>
    </div>

    <!-- Findings -->
    <ul class="sec-findings">${findingsHtml}</ul>
  `;
}

// ── SANDBOX CONTAINER MODULE ─────────────────────────────────
const sandboxFrame      = document.getElementById('sandboxFrame');
const sandboxLoadingEl  = document.getElementById('sandboxLoading');
const sandboxErrorEl    = document.getElementById('sandboxError');
const sandboxErrMsg     = document.getElementById('sandboxErrMsg');
const sandboxStatusSub  = document.getElementById('sandboxStatusSub');
const sandboxLiveBadge  = document.getElementById('sandboxLiveBadge');

// Block-count badges
const sbScripts   = document.getElementById('sb-scripts');
const sbForms     = document.getElementById('sb-forms');
const sbIframes   = document.getElementById('sb-iframes');
const sbRedirects = document.getElementById('sb-redirects');
const sbTracking  = document.getElementById('sb-tracking');
const sbHandlers  = document.getElementById('sb-handlers');

let sandboxUrl      = '';
let sandboxBlobUrl  = '';
let sandboxLoaded   = false;

function resetSandboxPanel() {
  sandboxUrl    = '';
  sandboxLoaded = false;
  if (sandboxBlobUrl) { URL.revokeObjectURL(sandboxBlobUrl); sandboxBlobUrl = ''; }
  sandboxFrame.src = '';
  sandboxFrame.classList.add('hidden');
  sandboxLoadingEl.classList.remove('hidden');
  sandboxErrorEl.classList.add('hidden');
  sandboxStatusSub.textContent = 'Ready — click Sandbox tab to load';
  sandboxLiveBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Standby`;
  sandboxLiveBadge.className = 'sandbox-live-badge';
  [sbScripts,sbForms,sbIframes,sbRedirects,sbTracking,sbHandlers].forEach(el => {
    el.className = 'sblock sblock-loading';
    void el.getBoundingClientRect();
  });
}

function updateSandboxBlocks(stats) {
  function setBlock(el, label, svgInner, count) {
    el.className = 'sblock sblock-blocked';
    el.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">${svgInner}</svg>
      ${label}
      <span class="sblock-count">${count > 0 ? count : '✓'}</span>
    `;
  }
  setBlock(sbScripts,   'Scripts',   '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',           stats.scripts);
  setBlock(sbForms,     'Forms',     '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>',     stats.forms);
  setBlock(sbIframes,   'Iframes',   '<rect x="2" y="3" width="20" height="14" rx="2"/>',                                 stats.iframes);
  setBlock(sbRedirects, 'Redirects', '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>',          stats.redirects);
  setBlock(sbTracking,  'Trackers',  '<circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2"/>',        stats.trackers);
  setBlock(sbHandlers,  'Events',    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',                          stats.handlers);
}

async function loadSandbox(url) {
  if (sandboxLoaded && sandboxUrl === url) return;

  sandboxUrl    = url;
  sandboxLoaded = false;

  sandboxFrame.classList.add('hidden');
  sandboxLoadingEl.classList.remove('hidden');
  sandboxErrorEl.classList.add('hidden');
  sandboxStatusSub.textContent = 'Preparing isolated workspace\u2026';
  sandboxLiveBadge.innerHTML   = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Preparing`;
  sandboxLiveBadge.className   = 'sandbox-live-badge';

  try {
    let rawContent = '';
    
    // Use cached HTML if the URL matches, otherwise fetch it
    if (cachedHtml && cachedHtmlUrl === url) {
      rawContent = cachedHtml;
    } else {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res  = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      const json = await res.json();
      if (!json.contents) throw new Error('Empty response from proxy');
      rawContent = json.contents;
      cachedHtml = json.contents;
      cachedHtmlUrl = url;
    }

    sandboxStatusSub.textContent = 'Applying CSP rules & disabling scripts\u2026';

    // Sanitize
    const { html, stats, links } = sanitizeForSandbox(rawContent, url);
    if (typeof renderExtractedLinks === 'function') renderExtractedLinks(links, url);

    // Create Blob URL
    if (sandboxBlobUrl) URL.revokeObjectURL(sandboxBlobUrl);
    const blob      = new Blob([html], { type: 'text/html;charset=utf-8' });
    sandboxBlobUrl  = URL.createObjectURL(blob);

    // Load into iframe
    sandboxFrame.onload = () => {
      setTimeout(() => { URL.revokeObjectURL(sandboxBlobUrl); sandboxBlobUrl = ''; }, 3000);
      sandboxLoaded = true;
    };
    sandboxFrame.src = sandboxBlobUrl;
    sandboxFrame.classList.remove('hidden');
    sandboxLoadingEl.classList.add('hidden');

    const total = stats.scripts + stats.trackers + stats.handlers + stats.iframes + stats.forms + stats.redirects;
    sandboxStatusSub.textContent = `\u2705 Fully isolated \u2014 ${total} threats neutralized`;
    sandboxLiveBadge.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg> Isolated`;
    sandboxLiveBadge.className   = 'sandbox-live-badge active';

    updateSandboxBlocks(stats);

  } catch (err) {
    sandboxLoadingEl.classList.add('hidden');
    sandboxFrame.classList.add('hidden');
    sandboxErrorEl.classList.remove('hidden');
    const msg = err.message || 'Unknown error';
    sandboxErrMsg.textContent = `Sandbox failed: ${msg}`;
    sandboxStatusSub.textContent = 'Could not load sandbox preview';
    sandboxLiveBadge.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Failed`;
  }
}

// ── EMAIL CHECKER & SCAM DETECTION MODULE ────────────────────
const emailInput       = document.getElementById('emailInput');
const emailClearBtn    = document.getElementById('emailClearBtn');
const emailCheckBtn    = document.getElementById('emailCheckBtn');
const emailBtnText     = document.getElementById('emailBtnText');
const emailBtnLoader   = document.getElementById('emailBtnLoader');
const emailResult      = document.getElementById('emailResult');

const emailSubSingle   = document.getElementById('emailSubSingle');
const emailSubBulk     = document.getElementById('emailSubBulk');
const emailSinglePanel = document.getElementById('emailSinglePanel');
const emailBulkPanel   = document.getElementById('emailBulkPanel');

const emailBulkInput      = document.getElementById('emailBulkInput');
const emailBulkCount      = document.getElementById('emailBulkCount');
const emailBulkClearBtn   = document.getElementById('emailBulkClearBtn');
const emailBulkRunBtn     = document.getElementById('emailBulkRunBtn');
const emailBulkBtnText    = document.getElementById('emailBulkBtnText');
const emailBulkBtnLoader  = document.getElementById('emailBulkBtnLoader');
const emailBulkResults    = document.getElementById('emailBulkResults');
const emailBulkTableBody  = document.getElementById('emailBulkTableBody');
const emailBulkSummary    = document.getElementById('emailBulkSummary');
const emailExportCsvBtn   = document.getElementById('emailExportCsvBtn');

function setEmailSubMode(mode) {
  if (mode === 'single') {
    emailSubSingle.classList.add('active');
    emailSubBulk.classList.remove('active');
    show(emailSinglePanel);
    hide(emailBulkPanel);
  } else {
    emailSubBulk.classList.add('active');
    emailSubSingle.classList.remove('active');
    hide(emailSinglePanel);
    show(emailBulkPanel);
  }
}
emailSubSingle.addEventListener('click', () => setEmailSubMode('single'));
emailSubBulk.addEventListener('click',   () => setEmailSubMode('bulk'));

document.querySelectorAll('.quick-btn[data-email]').forEach(btn => {
  btn.addEventListener('click', () => {
    emailInput.value = btn.dataset.email;
    emailClearBtn.classList.add('visible');
  });
});

emailClearBtn.addEventListener('click', () => {
  emailInput.value = '';
  emailClearBtn.classList.remove('visible');
  emailResult.classList.add('hidden');
  emailInput.focus();
});
emailInput.addEventListener('input', () => {
  emailClearBtn.classList.toggle('visible', emailInput.value.trim().length > 0);
});

emailBulkClearBtn.addEventListener('click', () => {
  emailBulkInput.value = '';
  emailBulkCount.textContent = '0';
  hide(emailBulkResults);
  hide(emailBulkSummary);
  emailBulkTableBody.innerHTML = '';
});
emailBulkInput.addEventListener('input', () => {
  const emails = parseEmailList(emailBulkInput.value);
  const n = Math.min(emails.length, 50);
  emailBulkCount.textContent = n;
  emailBulkCount.style.color = n >= 50 ? 'var(--red)' : '';
});

function parseEmailList(text) {
  return text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 50);
}

emailInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') runEmailCheckHook(emailInput.value.trim());
});
emailCheckBtn.addEventListener('click', () => runEmailCheckHook(emailInput.value.trim()));
emailBulkRunBtn.addEventListener('click', runBulkEmailCheck);

function renderEmailResult(data) {
  const { email, localPart, domain, formatOk, isDisposableFlag,
          mx, scam, verdict, verdictMeta } = data;
  const score = scam.score;

  const svgGood   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgWarn   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const svgDanger = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const svgInfo   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const iconMap   = { good: svgGood, warn: svgWarn, danger: svgDanger, info: svgInfo };

  const mxPass    = mx.hasMx === true;
  const mxUnknown = mx.hasMx === null;
  const mxIcon    = mxUnknown ? 'warn' : mxPass ? 'pass' : 'fail';
  const mxLabel   = mxUnknown ? 'Unknown (net error)' : mxPass ? `${mx.count} server${mx.count > 1 ? 's' : ''} found` : 'No MX records';

  const dispIcon  = isDisposableFlag ? 'fail' : 'pass';
  const dispLabel = isDisposableFlag ? 'Yes — Temporary Address' : 'No — Persistent Domain';

  const fillCls = emailScoreFillCls(verdict);

  const findingsHtml = scam.findings.map(f => `
    <li class="email-finding-item ${f.type}">
      ${iconMap[f.type] || svgInfo}
      <span>${escapeHtml(f.text)}</span>
    </li>`).join('');

  emailResult.innerHTML = `
    <!-- Verdict band -->
    <div class="email-verdict-band ${verdictMeta.cls}">
      <span class="email-verdict-icon">${verdictMeta.icon}</span>
      <div class="email-verdict-info">
        <span class="email-verdict-title">${escapeHtml(verdictMeta.label)}</span>
        <span class="email-verdict-sub">${escapeHtml(email)} &mdash; ${escapeHtml(verdictMeta.msg)}</span>
      </div>
      <span class="email-score-pill">${score}</span>
    </div>

    <!-- Checks grid -->
    <div class="email-checks">
      <div class="email-check-item">
        <span class="email-check-icon ${formatOk ? 'pass' : 'fail'}">${formatOk ? svgGood : svgDanger}</span>
        <span class="email-check-label">Format</span>
        <span class="email-check-val">${formatOk ? 'Valid RFC 5322' : 'Invalid format'}</span>
      </div>
      <div class="email-check-item">
        <span class="email-check-icon info">${svgInfo}</span>
        <span class="email-check-label">Local Part</span>
        <span class="email-check-val" title="${escapeHtml(localPart)}">${escapeHtml(localPart)}</span>
      </div>
      <div class="email-check-item">
        <span class="email-check-icon info">${svgInfo}</span>
        <span class="email-check-label">Domain</span>
        <span class="email-check-val">${escapeHtml(domain)}</span>
      </div>
      <div class="email-check-item">
        <span class="email-check-icon ${mxIcon}">${mxIcon === 'pass' ? svgGood : mxIcon === 'warn' ? svgWarn : svgDanger}</span>
        <span class="email-check-label">MX Records</span>
        <span class="email-check-val">${escapeHtml(mxLabel)}</span>
      </div>
      <div class="email-check-item">
        <span class="email-check-icon ${dispIcon}">${isDisposableFlag ? svgDanger : svgGood}</span>
        <span class="email-check-label">Disposable</span>
        <span class="email-check-val">${escapeHtml(dispLabel)}</span>
      </div>
      <div class="email-check-item">
        <span class="email-check-icon ${score <= 10 ? 'pass' : score <= 40 ? 'warn' : 'fail'}">${score <= 10 ? svgGood : score <= 40 ? svgWarn : svgDanger}</span>
        <span class="email-check-label">Scam Score</span>
        <span class="email-check-val">${score} / 100</span>
      </div>
    </div>

    <!-- Score bar -->
    <div class="email-score-wrap">
      <div class="email-score-label"><span>Scam Risk Score</span><span>${score} / 100</span></div>
      <div class="email-score-track">
        <div class="email-score-fill ${fillCls}" style="width:${score}%"></div>
      </div>
    </div>

    <!-- Findings -->
    <div class="email-findings">
      <div class="email-findings-title">Analysis Details</div>
      <ul class="email-finding-list">${findingsHtml}</ul>
    </div>
  `;

  emailResult.classList.remove('hidden');
}

async function runEmailCheckHook(email) {
  if (!email) { emailInput.focus(); return; }

  show(emailBtnLoader);
  hide(emailBtnText);
  emailResult.classList.add('hidden');

  const data = await checkEmail(email);
  renderEmailResult(data);

  hide(emailBtnLoader);
  show(emailBtnText);
}

let emailBulkData = [];

async function runBulkEmailCheck() {
  const emails = parseEmailList(emailBulkInput.value);
  if (!emails.length) return;

  show(emailBulkBtnLoader);
  hide(emailBulkBtnText);
  emailBulkTableBody.innerHTML = '';
  emailBulkData = [];
  show(emailBulkResults);
  hide(emailBulkSummary);

  let countValid = 0, countScam = 0, countDisp = 0;

  for (let i = 0; i < emails.length; i++) {
    const email  = emails[i];
    const data = await checkEmail(email);
    
    const row = {
      index: i + 1, email, domain: data.domain, formatOk: data.formatOk, isDisp: data.isDisposableFlag,
      mxOk: data.mx.hasMx, mxCount: data.mx.count,
      score: data.scam.score, verdict: data.verdict, verdictMeta: data.verdictMeta
    };
    emailBulkData.push(row);

    if (data.verdict === 'clean' || data.verdict === 'low') countValid++;
    if (['high','critical','disposable'].includes(data.verdict)) countScam++;
    if (data.isDisposableFlag) countDisp++;

    const tr = buildEmailTableRow(row);
    emailBulkTableBody.appendChild(tr);

    if (i < emails.length - 1) await sleep(400);
  }

  document.getElementById('esum-total').textContent = emails.length;
  document.getElementById('esum-valid').textContent = countValid;
  document.getElementById('esum-scam').textContent  = countScam;
  document.getElementById('esum-disposable').textContent = countDisp;
  show(emailBulkSummary);

  hide(emailBulkBtnLoader);
  show(emailBulkBtnText);
}

function buildEmailTableRow(row) {
  const { index, email, domain, formatOk, isDisp, mxOk, mxCount, score, verdict, verdictMeta } = row;

  const svgOk  = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgBad = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const svgQ   = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

  const mxDisp  = mxOk === true ? `${svgOk} ${mxCount}` : mxOk === null ? svgQ : svgBad;
  const dispDisp = isDisp ? `${svgBad} Yes` : `${svgOk} No`;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${index}</td>
    <td title="${escapeHtml(email)}">${escapeHtml(email)}</td>
    <td>${formatOk ? svgOk : svgBad}</td>
    <td>${mxDisp}</td>
    <td>${dispDisp}</td>
    <td style="font-family:'Space Grotesk',sans-serif;font-weight:700;color:${score <= 10 ? 'var(--green)' : score <= 40 ? 'var(--yellow)' : 'var(--red)'}">${score}</td>
    <td><span class="ev-badge ${verdictMeta.badgeCls}">${verdictMeta.icon} ${escapeHtml(verdictMeta.label)}</span></td>
  `;
  return tr;
}

emailExportCsvBtn.addEventListener('click', () => {
  if (!emailBulkData.length) return;
  const header = ['#','Email','Domain','Format OK','MX OK','MX Servers','Disposable','Scam Score','Verdict'];
  const rows   = emailBulkData.map(r => [
    r.index, r.email, r.domain,
    r.formatOk ? 'Yes' : 'No',
    r.mxOk === true ? 'Yes' : r.mxOk === null ? 'Unknown' : 'No',
    r.mxCount || 0,
    r.isDisp ? 'Yes' : 'No',
    r.score,
    r.verdictMeta.label
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = blobUrl;
  a.download = `email-check-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(blobUrl);
});

// ── Bulk diagnostics ─────────────────────────────────────────
// ── Navigation & View Switching ──────────────────────────────
const views = {
  single: {
    title: 'Single Inspector',
    el: document.getElementById('singleView'),
    nav: document.getElementById('navSingle')
  },
  bulk: {
    title: 'Bulk Sites Scan',
    el: document.getElementById('bulkView'),
    nav: document.getElementById('navBulk')
  },
  email: {
    title: 'Email Validator',
    el: document.getElementById('emailView'),
    nav: document.getElementById('navEmail')
  },
  history: {
    title: 'Scan History Logs',
    el: document.getElementById('historyView'),
    nav: document.getElementById('navHistory')
  }
};

const viewTitleEl = document.getElementById('currentViewTitle');

function setMode(mode) {
  Object.keys(views).forEach(key => {
    const v = views[key];
    if (v.el) v.el.classList.toggle('hidden', key !== mode);
    if (v.nav) v.nav.classList.toggle('active', key === mode);
  });
  
  if (viewTitleEl && views[mode]) {
    viewTitleEl.textContent = views[mode].title;
  }
  
  if (mode === 'history') {
    renderCloudHistory();
  }
}

if (document.getElementById('navSingle')) {
  document.getElementById('navSingle').addEventListener('click', () => setMode('single'));
  document.getElementById('navBulk').addEventListener('click', () => setMode('bulk'));
  document.getElementById('navEmail').addEventListener('click', () => setMode('email'));
  document.getElementById('navHistory').addEventListener('click', () => setMode('history'));
}

// ── Hamburger Toggle & Sidebar Actions ────────────────────────
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarEl     = document.querySelector('.sidebar');

if (sidebarToggle && sidebarEl) {
  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebarEl.classList.toggle('collapsed');
    sidebarEl.classList.toggle('active');
  });

  // Click outside sidebar on mobile to dismiss it
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900) {
      if (!sidebarEl.contains(e.target) && e.target !== sidebarToggle && !sidebarToggle.contains(e.target)) {
        sidebarEl.classList.remove('active');
      }
    }
  });

  // Clicking a nav item on mobile closes the side menu
  const navItems = sidebarEl.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        sidebarEl.classList.remove('active');
      }
    });
  });
}

// ── Bulk Scan DOM Elements & State ───────────────────────────
const bulkInput        = document.getElementById('bulkInput');
const bulkCount        = document.getElementById('bulkCount');
const bulkClearBtn     = document.getElementById('bulkClearBtn');
const bulkRunBtn       = document.getElementById('bulkRunBtn');
const bulkBtnText      = document.getElementById('bulkBtnText');
const bulkBtnLoader    = document.getElementById('bulkBtnLoader');

const bulkResults      = document.getElementById('bulkResults');
const bulkProgressWrap = document.getElementById('bulkProgressWrap');
const bulkProgressLabel= document.getElementById('bulkProgressLabel');
const bulkProgressFill = document.getElementById('bulkProgressFill');
const bulkStopBtn      = document.getElementById('bulkStopBtn');
const bulkSummary      = document.getElementById('bulkSummary');
const sumTotal         = document.getElementById('sumTotal');
const sumOk            = document.getElementById('sumOk');
const sumErr           = document.getElementById('sumErr');
const sumTime          = document.getElementById('sumTime');
const exportCsvBtn     = document.getElementById('exportCsvBtn');
const bulkTableBody    = document.getElementById('bulkTableBody');

const MAX_BULK   = 25;
const DELAY_MS   = 600;
let bulkRunning  = false;
let bulkAbort    = false;
let bulkData     = [];

bulkInput.addEventListener('input', updateBulkCount);

function updateBulkCount() {
  const urls = parseBulkUrls(bulkInput.value);
  const n = Math.min(urls.length, MAX_BULK);
  bulkCount.textContent = n;
  bulkCount.style.color = n >= MAX_BULK ? 'var(--red)' : '';
}

function parseBulkUrls(text) {
  return text
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => normalizeUrl(s))
    .filter(Boolean)
    .slice(0, MAX_BULK);
}

bulkClearBtn.addEventListener('click', () => {
  bulkInput.value = '';
  updateBulkCount();
});

bulkStopBtn.addEventListener('click', () => {
  bulkAbort = true;
  bulkStopBtn.disabled = true;
  bulkProgressLabel.textContent = 'Stopping\u2026';
});

bulkRunBtn.addEventListener('click', startBulkCheck);

async function startBulkCheck() {
  if (bulkRunning) return;

  const urls = parseBulkUrls(bulkInput.value);
  if (!urls.length) {
    bulkInput.focus();
    bulkInput.style.borderColor = 'var(--red)';
    setTimeout(() => { bulkInput.style.borderColor = ''; }, 1500);
    return;
  }

  bulkRunning = true;
  bulkAbort   = false;
  bulkData    = [];

  hide(bulkBtnText); show(bulkBtnLoader);
  bulkRunBtn.disabled = true;

  show(bulkResults);
  hide(bulkSummary);
  bulkTableBody.innerHTML = '';
  bulkStopBtn.disabled = false;

  urls.forEach((url, i) => {
    bulkTableBody.appendChild(makeSkeletonRow(i + 1, url));
  });

  const startTime = Date.now();
  let okCount  = 0;
  let errCount = 0;

  for (let i = 0; i < urls.length; i++) {
    if (bulkAbort) break;

    const url = urls[i];
    const pct = Math.round((i / urls.length) * 100);

    bulkProgressFill.style.width = pct + '%';
    bulkProgressLabel.textContent = `Checking ${i + 1} of ${urls.length}: ${getDomain(url)}`;

    const rowEl = document.getElementById(`bulk-row-${i}`);
    if (rowEl) rowEl.classList.add('bulk-row-checking');

    let result = null;
    try {
      result = await fetchSiteData(url);
    } catch(e) {
      const { category } = classifySite(url, getDomain(url), '');
      const threat = heuristicScan(url);
      result = { ok: false, url, title: getDomain(url), desc: 'Error fetching data.', category, lang: null, threat,
                 favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32` };
    }

    result.index = i + 1;
    bulkData.push(result);
    if (result.ok) okCount++; else errCount++;

    if (rowEl) rowEl.replaceWith(makeResultRow(result));

    if (i < urls.length - 1 && !bulkAbort) await sleep(DELAY_MS);
  }

  bulkProgressFill.style.width = '100%';
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const done    = bulkAbort ? `Stopped after ${bulkData.length}` : `Done \u2014 all ${urls.length}`;
  bulkProgressLabel.textContent = `${done} URLs checked in ${elapsed}s`;

  sumTotal.textContent = bulkData.length;
  sumOk.textContent    = okCount;
  sumErr.textContent   = errCount;
  sumTime.textContent  = elapsed + 's';
  show(bulkSummary);

  bulkRunning = false;
  bulkAbort   = false;
  show(bulkBtnText); hide(bulkBtnLoader);
  bulkRunBtn.disabled = false;
  bulkStopBtn.disabled = true;
  if (window.updateBulkTableFilters) window.updateBulkTableFilters();
}

async function fetchSiteData(url) {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&video=false`;
  const res    = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
  const json   = await res.json();

  if (json.status === 'success' || json.status === 'partial') {
    const d = json.data;
    const title = d.title || d.publisher || getDomain(url);
    const desc  = d.description || '';
    const lang  = d.lang || null;
    const { category } = classifySite(url, title, desc);
    const threat = heuristicScan(url);
    return { ok: true, url, title, desc, lang, category, threat,
             favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32` };
  }
  const { category } = classifySite(url, getDomain(url), '');
  const threat = heuristicScan(url);
  return { ok: false, url, title: getDomain(url), desc: 'Could not fetch metadata.', lang: null, category, threat,
           favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32` };
}

function makeSkeletonRow(num, url) {
  const tr = document.createElement('tr');
  tr.id = `bulk-row-${num - 1}`;
  tr.className = 'sk-row';
  tr.innerHTML = `
    <td><span class="row-num">${num}</span></td>
    <td><div class="sk-cell" style="width:28px;height:28px;border-radius:6px"></div></td>
    <td>
      <div class="sk-cell" style="width:200px;margin-bottom:6px"></div>
      <div class="sk-cell" style="width:130px"></div>
    </td>
    <td><div class="sk-cell" style="width:110px"></div></td>
    <td><div class="sk-cell" style="width:70px"></div></td>
    <td><div class="sk-cell" style="width:220px"></div></td>
    <td><div class="sk-cell" style="width:90px"></div></td>
    <td><div class="sk-cell" style="width:80px"></div></td>
  `;
  return tr;
}

function makeResultRow(r) {
  if (!r.url || (!r.url.startsWith('https://') && !r.url.startsWith('http://'))) {
    r = { ...r, url: '#' };
  }
  const tr = document.createElement('tr');

  const statusHtml = r.ok
    ? `<span class="badge badge-ok" style="font-size:0.72rem;padding:3px 8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
        OK</span>`
    : `<span class="badge badge-err" style="font-size:0.72rem;padding:3px 8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Failed</span>`;

  const cat = r.category;
  const catHtml = cat
    ? `<span class="category-badge ${cat.cssClass}" style="padding:4px 10px;font-size:0.72rem;animation:none">${cat.emoji} ${cat.label}</span>`
    : `<span style="color:var(--text-dim);font-size:0.78rem">&mdash;</span>`;

  const thr = r.threat;
  const thrMeta = thr ? THREAT_META[thr.level] : THREAT_META['safe'];
  const threatHtml = `<span class="threat-badge-mini thr-${thrMeta.cls}">${thrMeta.icon} ${thrMeta.label}</span>`;

  tr.innerHTML = `
    <td><span class="row-num">${r.index}</span></td>
    <td><img class="row-favicon" src="${escapeHtml(r.favicon)}" alt="" onerror="this.style.display='none'"/></td>
    <td class="row-url-cell">
      <span class="row-url" title="${escapeHtml(r.url)}">${escapeHtml(r.url)}</span>
      <span class="row-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</span>
    </td>
    <td>${catHtml}</td>
    <td>${statusHtml}</td>
    <td>${threatHtml}</td>
    <td><span class="row-desc" title="${escapeHtml(r.desc)}">${r.desc ? escapeHtml(r.desc) : '&mdash;'}</span></td>
    <td>
      <div class="row-actions">
        <a class="row-action-btn" href="${safeHref(r.url)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open
        </a>
        <button class="row-action-btn inspect-btn" data-url="${escapeHtml(r.url)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Inspect
        </button>
      </div>
    </td>
  `;
  tr.querySelector('.inspect-btn').addEventListener('click', () => inspectFromBulk(r.url));
  return tr;
}

function inspectFromBulk(url) {
  setMode('single');
  urlInput.value = url;
  clearBtn.classList.add('visible');
  checkSite(url);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

exportCsvBtn.addEventListener('click', () => {
  if (!bulkData.length) return;

  const header = ['#','URL','Title','Category','Status','Language','Description'];
  const rows = bulkData.map(r => [
    r.index, r.url, r.title,
    r.category ? r.category.label : 'Unknown',
    r.ok ? 'Reachable' : 'Failed',
    r.lang || '',
    r.desc
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `bulk-check-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(blobUrl);
});

// ── History & IP Intel ─────────────────────────────────────────
const HISTORY_API_URL = 'https://kvdb.io/bucket/sitescope_v4_history/history';

async function fetchCloudHistory() {
  try {
    const res = await fetch(HISTORY_API_URL);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function saveCloudHistory(url, title, favicon, threatLevel) {
  try {
    let history = await fetchCloudHistory();
    if (!Array.isArray(history)) history = [];
    history = history.filter(item => item.url !== url);
    history.unshift({
      url,
      title: title || url,
      favicon: favicon || '',
      threat: threatLevel,
      time: new Date().toISOString()
    });
    history = history.slice(0, 50);

    await fetch(HISTORY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(history)
    });
    renderCloudHistory();
  } catch (e) {
    console.error('History save error', e);
  }
}

async function clearCloudHistory() {
  try {
    await fetch(HISTORY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([])
    });
    renderCloudHistory();
  } catch (e) {
    console.error('History clear error', e);
  }
}

function renderCloudHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  historyList.innerHTML = '<div class="history-loading">Loading...</div>';
  fetchCloudHistory().then(data => {
    if (!data || !data.length) {
      historyList.innerHTML = '<div class="history-loading">No history found.</div>';
      return;
    }
    historyList.innerHTML = '';
    data.forEach(item => {
      const date = new Date(item.time).toLocaleString();
      const threatColor = item.threat === 'safe' ? '#22c55e' : (item.threat === 'critical' ? '#ef4444' : (item.threat === 'low' ? '#fde047' : '#f59e0b'));
      
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <img class="history-favicon" src="${escapeHtml(item.favicon)}" onerror="this.style.display='none'" />
        <div class="history-url">${escapeHtml(item.title)}</div>
        <div class="history-threat" style="color:${threatColor}">${escapeHtml(item.threat)}</div>
        <div class="history-time">${date}</div>
      `;
      div.addEventListener('click', () => {
        setMode('single');
        urlInput.value = item.url;
        if (clearBtn) clearBtn.classList.add('visible');
        checkSite(item.url);
      });
      historyList.appendChild(div);
    });
  });
}

function renderQrCode(url) {
  const qrImage = document.getElementById('qrImage');
  const showQrBtn = document.getElementById('showQrBtn');
  if (!qrImage || !showQrBtn) return;
  qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url);
  document.getElementById('qrUrlText').textContent = url;
  showQrBtn.classList.remove('hidden');
}

async function fetchIpIntel(domain) {
  const ipEl = document.getElementById('intelIp');
  const locEl = document.getElementById('intelLoc');
  if (!ipEl || !locEl) return;
  try {
    ipEl.textContent = 'Fetching...';
    locEl.textContent = '...';
    document.getElementById('intelGrid').classList.remove('hidden');
    const res = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(domain));
    const data = await res.json();
    if (data.Answer && data.Answer.length > 0) {
      const ip = data.Answer.find(a => a.type === 1);
      if (ip) {
        ipEl.textContent = ip.data;
        locEl.textContent = 'DNS Resolved';
        return;
      }
    }
    ipEl.textContent = 'No A record';
    locEl.textContent = 'Unknown';
  } catch {
    ipEl.textContent = 'Unavailable';
    locEl.textContent = 'Unavailable';
  }
}

function renderExtractedLinks(links, baseUrl) {
  const panel = document.getElementById('linkExtractorPanel');
  const countSpan = document.getElementById('linkExtCount');
  const list = document.getElementById('linkExtList');
  if (!panel) return;
  
  if (!links || links.length === 0) {
    panel.style.display = 'none';
    return;
  }
  
  panel.style.display = 'block';
  const unique = [];
  const seen = new Set();
  for (let l of links) {
    if (!seen.has(l.url)) {
      seen.add(l.url);
      unique.push(l);
    }
  }
  
  countSpan.textContent = unique.length;
  try {
    const baseHost = new URL(baseUrl).hostname;
    list.innerHTML = unique.map(l => {
      const isExternal = new URL(l.url).hostname !== baseHost;
      const badge = isExternal ? '<span class="link-ext-badge link-ext-external">EXT</span>' : '<span class="link-ext-badge link-ext-internal">INT</span>';
      return '<div class="link-item">' + badge + '<a href="' + escapeHtml(l.url) + '" target="_blank">' + escapeHtml(l.text || l.url) + '</a></div>';
    }).join('');
  } catch (e) {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('DOMContentLoaded', () => {
  const historyBtn = document.getElementById('historyBtn');
  const historyDropdown = document.getElementById('historyDropdown');
  const historyClearBtn = document.getElementById('historyClearBtn');
  const showQrBtn = document.getElementById('showQrBtn');
  const qrModal = document.getElementById('qrModal');
  const qrCloseBtn = document.getElementById('qrCloseBtn');
  const linkExtHeader = document.getElementById('linkExtHeader');
  const linkExtList = document.getElementById('linkExtList');

  if (historyBtn) {
    historyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      historyDropdown.classList.toggle('hidden');
      if (!historyDropdown.classList.contains('hidden')) renderCloudHistory();
    });
    document.addEventListener('click', () => historyDropdown.classList.add('hidden'));
    historyDropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  if (historyClearBtn) historyClearBtn.addEventListener('click', clearCloudHistory);

  if (showQrBtn) showQrBtn.addEventListener('click', () => qrModal.classList.remove('hidden'));
  if (qrCloseBtn) qrCloseBtn.addEventListener('click', () => qrModal.classList.add('hidden'));
  
  if (linkExtHeader) linkExtHeader.addEventListener('click', () => linkExtList.classList.toggle('hidden'));

  // Advanced Intelligence Tabs Event Listeners
  const advTabs = document.querySelectorAll('#advancedIntelTabs .tab-btn');
  advTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      advTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.intel-tab-content').forEach(c => c.classList.add('hidden'));
      
      if (tabName === 'whois') show(document.getElementById('intelTabWhois'));
      else if (tabName === 'headers') show(document.getElementById('intelTabHeaders'));
      else if (tabName === 'dns') show(document.getElementById('intelTabDns'));
      else if (tabName === 'ssl') show(document.getElementById('intelTabSsl'));
      else if (tabName === 'stack') show(document.getElementById('intelTabStack'));
      else if (tabName === 'robots') show(document.getElementById('intelTabRobots'));
      else if (tabName === 'latency') show(document.getElementById('intelTabLatency'));
    });
  });

  // Bulk Table Filter/Sort
  const bulkFilterInput = document.getElementById('bulkFilterInput');
  const bulkFilterThreat = document.getElementById('bulkFilterThreat');
  const headers = document.querySelectorAll('.bulk-table th.sortable');
  let sortCol = 'id';
  let sortAsc = true;

  function renderBulkTable() {
    if (typeof bulkData === 'undefined') return;
    const filterText = (bulkFilterInput && bulkFilterInput.value || '').toLowerCase();
    const threatFilter = bulkFilterThreat ? bulkFilterThreat.value : 'all';
    
    let filtered = bulkData.filter(r => {
      if (filterText && !r.url.toLowerCase().includes(filterText) && !r.title.toLowerCase().includes(filterText) && !(r.category && r.category.label.toLowerCase().includes(filterText))) return false;
      if (threatFilter === 'safe' && r.threat && r.threat.level !== 'safe') return false;
      if (threatFilter === 'risk' && (!r.threat || !['high', 'critical'].includes(r.threat.level))) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortCol === 'id') { valA = a.index; valB = b.index; }
      else if (sortCol === 'url') { valA = a.url; valB = b.url; }
      else if (sortCol === 'category') { valA = a.category ? a.category.label : ''; valB = b.category ? b.category.label : ''; }
      else if (sortCol === 'status') { valA = a.ok ? 1 : 0; valB = b.ok ? 1 : 0; }
      else if (sortCol === 'threats') { valA = a.threat ? a.threat.score : 0; valB = b.threat ? b.threat.score : 0; }
      
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    const tbody = document.getElementById('bulkTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    filtered.forEach(r => {
      tbody.appendChild(makeResultRow(r));
    });
  }

  if (bulkFilterInput) bulkFilterInput.addEventListener('input', renderBulkTable);
  if (bulkFilterThreat) bulkFilterThreat.addEventListener('change', renderBulkTable);
  
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); });
      th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
      renderBulkTable();
    });
  });
  
  window.updateBulkTableFilters = renderBulkTable;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service worker registration failed: ', err);
    });
  });
}
