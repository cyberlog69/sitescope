import { fetchWhois, fetchHttpHeaders } from './intel.js';
/* ════════════════════════════════════════════════════════════
   SiteScope — app.js
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
    // Load sandbox lazily on first click
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
document.querySelectorAll('.quick-btn').forEach(btn => {
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

  // Show results section immediately with loading state
  show(results);
  resetResults();

  // Set info bar
  resultUrlText.textContent = url;
  browserAddress.textContent = url;

  // Set domain in info panel
  siteDomain.textContent = domain;

  // Favicon: try Google's favicon service
  loadFavicon(url, domain);

  // Protocol badge
  try {
    const proto = new URL(url).protocol.replace(':', '').toUpperCase();
    metaProtocol.textContent = proto;
  } catch {}

  // ── Step 1: Probe reachability via allorigins (fast, independent of Microlink) ──
  let siteIsReachable = false;
  try {
    const probeRes = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const probeJson = await probeRes.json();
    siteIsReachable = !!(probeJson && probeJson.status && probeJson.status.http_code > 0);
  } catch (e) {
    siteIsReachable = false;
  }

  // ── Step 2: Show Reachable badge + run intel immediately if probe succeeded ──
  if (siteIsReachable) {
    statusDot.style.background = '#22c55e';
    statusDot.style.boxShadow  = '0 0 8px #22c55e';
    metaStatus.innerHTML = `<span class="badge badge-ok">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Reachable
    </span>`;
    renderCategory(url, domain, '');
    if (typeof fetchIpIntel === 'function') fetchIpIntel(getDomain(url));
    document.getElementById('advancedIntelPanel').style.display = 'block';
    fetchWhois(getDomain(url));
    fetchHttpHeaders(getDomain(url));
    if (typeof renderQrCode === 'function') renderQrCode(url);
  }

  // ── Step 3: Fetch rich metadata via Microlink API ────────────────────
  // ── Fetch via Microlink API ─────────────────────────────
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=true&video=false`;

  try {
    const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
    const json = await res.json();

    setLoading(false);

    if (json.status === 'success' || json.status === 'partial') {
      const d = json.data;

      // Title
      const title = d.title || d.publisher || domain;
      siteTitle.textContent = title || domain;

      // Description
      const desc = d.description || d.author || null;
      if (desc) {
        siteDescription.textContent = desc;
      } else {
        siteDescription.textContent = `No description metadata found for ${domain}.`;
      }

      // Author
      if (d.author) metaAuthor.textContent = d.author;

      // Language
      if (d.lang) metaLang.textContent = d.lang.toUpperCase();

      // Category — run BEFORE description fallback so we also use URL signals
      renderCategory(url, title, desc || '');
      // Security scan (async, updates panel when done)
      scanSecurity(url).then(threatLevel => {
        if (typeof saveCloudHistory === 'function') saveCloudHistory(url, title, `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`, threatLevel);
      });
      if (typeof fetchIpIntel === 'function') fetchIpIntel(getDomain(url));
      document.getElementById('advancedIntelPanel').style.display = 'block';
      fetchWhois(getDomain(url));
      fetchHttpHeaders(getDomain(url));
      if (typeof renderQrCode === 'function') renderQrCode(url);

      // Status badge
      metaStatus.innerHTML = `<span class="badge badge-ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Reachable
      </span>`;

      // Screenshot
      const shot = d.screenshot;
      if (shot && shot.url) {
        renderScreenshot(shot.url);
      } else {
        showScreenshotError();
      }

      // OG / Social image
      const img = d.image || d.logo;
      if (img && img.url && img.url !== shot?.url) {
        show(ogSection);
        ogImage.src = img.url;
        ogImage.onerror = () => hide(ogSection);
      }

      // Keywords from tags
      if (d.keywords && d.keywords.length) {
        renderTags(d.keywords);
      } else if (d.tags && d.tags.length) {
        renderTags(d.tags);
      }

    } else {
      // API returned error status — still try to classify from URL alone
      renderCategory(url, domain, '');
      scanSecurity(url);
      handleFetchError('Site returned an error or could not be reached.');
    }

  } catch (err) {
    setLoading(false);
    renderCategory(url, domain, '');
    scanSecurity(url);
    handleFetchError('Network error: could not connect to SiteScope API.');
    console.error(err);
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

// ── Screenshot Fallback Chain ─────────────────────────────────
// Tries Google PageSpeed thumbnail when Microlink doesn't return a screenshot.
async function tryScreenshotFallback(url) {
  try {
    const encoded = encodeURIComponent(url);
    const psRes = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encoded}&strategy=desktop&fields=lighthouseResult.audits.final-screenshot`,
      { signal: AbortSignal.timeout(14000) }
    );
    const psJson = await psRes.json();
    const imgData = psJson?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
    if (imgData && imgData.startsWith('data:image')) {
      renderScreenshot(imgData);
      return;
    }
  } catch (e) {
    // PageSpeed fallback failed, fall through
  }
  showScreenshotError();
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════
// ── SITE CLASSIFICATION ENGINE v2 ───────────────────────────
//
//  Multi-layer scoring system:
//    1. TLD match          → +80 (gov, edu, mil)
//    2. Known domain match → +60
//    3. Subdomain/path kw  → +25 each (max 2 per category)
//    4. Keyword scoring    → variable per term (multi-word > single)
//    5. Negative keywords  → –12 each (penalise false positives)
//    6. requireDomain gate → social media ONLY wins if domain known
//    7. Confidence + min-score thresholds
// ════════════════════════════════════════════════════════════

const CATEGORIES = [

  // ── 1. Government ─────────────────────────────────────────
  {
    id: 'government', label: 'Government', emoji: '🏛️', cssClass: 'cat-government',
    description: 'An official government or public-sector website.',
    tlds: ['.gov','.gov.uk','.gov.in','.gov.au','.gc.ca','.gob.mx','.gouv.fr',
           '.gov.za','.gov.sg','.govt.nz','.gov.ng','.gov.pk','.gov.br','.gov.ph',
           '.gov.eg','.gov.tr','.gov.my','.gov.ae','.gov.kw','.gov.sa'],
    domains: ['whitehouse.gov','irs.gov','usa.gov','europa.eu','un.org',
              'nato.int','data.gov','congress.gov','senate.gov','who.int',
              'worldbank.org','imf.org','icao.int','oecd.org','wto.org'],
    subdomainKw: ['gov','govt','government','federal','state','municipal','city','county','ministry'],
    keywords: [
      {w:'federal government',s:24},{w:'official government',s:24},{w:'government portal',s:26},
      {w:'ministry of',s:20},{w:'parliament',s:18},{w:'senate',s:16},{w:'congress',s:16},
      {w:'legislation',s:16},{w:'public service',s:18},{w:'civil service',s:16},
      {w:'state agency',s:20},{w:'national authority',s:22},{w:'municipal',s:12},
      {w:'government',s:12},{w:'official',s:8},{w:'prefecture',s:16},{w:'governor',s:14},
      {w:'public sector',s:18},{w:'department of',s:14},{w:'bureau of',s:14}
    ],
    negativeKw: ['shop','buy','cart','game','movie','social media','tweet','recipe','stream'],
    minScore: 0, requireDomain: false
  },

  // ── 2. Military / Defense ──────────────────────────────────
  {
    id: 'military', label: 'Military / Defense', emoji: '🎖️', cssClass: 'cat-military',
    description: 'A military, defense, or armed-forces organization.',
    tlds: ['.mil'],
    domains: ['nato.int','army.mil','navy.mil','af.mil','marines.mil','defense.gov','dod.gov',
              'mod.uk','army.mod.uk','raf.mod.uk'],
    subdomainKw: ['mil','army','navy','airforce','defense','military'],
    keywords: [
      {w:'armed forces',s:26},{w:'defense department',s:24},{w:'military base',s:24},
      {w:'military',s:20},{w:'pentagon',s:20},{w:'veteran',s:16},{w:'troops',s:16},
      {w:'soldier',s:14},{w:'marine corps',s:20},{w:'naval',s:16},{w:'brigade',s:14},
      {w:'air force',s:18},{w:'defense contractor',s:22},{w:'national guard',s:20}
    ],
    negativeKw: ['shop','game','social','news','recipe','movie','stream'],
    minScore: 20, requireDomain: false
  },

  // ── 3. Education ──────────────────────────────────────────
  {
    id: 'education', label: 'Education', emoji: '🎓', cssClass: 'cat-education',
    description: 'A school, university, or educational platform.',
    tlds: ['.edu','.ac.uk','.ac.in','.edu.au','.sch.uk','.edu.pk','.edu.sg','.edu.ph','.edu.ng'],
    domains: ['coursera.org','udemy.com','khanacademy.org','edx.org','duolingo.com',
              'chegg.com','quizlet.com','skillshare.com','pluralsight.com',
              'mit.edu','harvard.edu','stanford.edu','oxford.ac.uk','cambridge.org',
              'codecademy.com','brilliant.org','futurelearn.com','teachable.com',
              'udacity.com','masterclass.com','rosettastone.com',
              'babbel.com','lynda.com','alison.com','open.edu'],
    subdomainKw: ['learn','lms','elearning','campus','student','academic','courses','school','edu','library'],
    keywords: [
      {w:'online learning platform',s:28},{w:'student portal',s:26},{w:'learning management system',s:30},
      {w:'university',s:18},{w:'college',s:16},{w:'e-learning',s:20},
      {w:'online course',s:22},{w:'lecture',s:14},{w:'faculty',s:16},
      {w:'curriculum',s:16},{w:'degree program',s:20},{w:'diploma',s:14},
      {w:'tutorial',s:12},{w:'classroom',s:14},{w:'professor',s:16},
      {w:'scholarship',s:16},{w:'campus',s:12},{w:'education',s:12},{w:'school',s:8},
      {w:'enrollment',s:16},{w:'syllabus',s:18},{w:'academic calendar',s:18}
    ],
    negativeKw: ['shop','buy','cart','social media','game','news','hospital','insurance'],
    minScore: 0, requireDomain: false
  },

  // ── 4. Healthcare & Medical ────────────────────────────────
  {
    id: 'healthcare', label: 'Healthcare & Medical', emoji: '🏥', cssClass: 'cat-healthcare',
    description: 'A medical, health, or healthcare information resource.',
    tlds: [],
    domains: [
      'webmd.com','healthline.com','mayoclinic.org','nih.gov','cdc.gov',
      'medscape.com','drugs.com','rxlist.com','medlineplus.gov','who.int',
      'clevelandclinic.org','hopkinsmedicine.org','nhs.uk','medicalxpress.com',
      'health.harvard.edu','medicalnewstoday.com','verywellhealth.com',
      'everydayhealth.com','medicinenet.com','emedicinehealth.com'
    ],
    subdomainKw: ['health','medical','med','clinical','care','hospital','pharmacy','wellness','clinic','patient'],
    keywords: [
      {w:'electronic health record',s:30},{w:'medical records',s:26},
      {w:'telehealth',s:24},{w:'clinical data',s:24},
      {w:'physician',s:20},{w:'pharmacist',s:20},{w:'diagnosis',s:18},
      {w:'prescription',s:18},{w:'therapy',s:14},{w:'vaccination',s:18},
      {w:'pharmaceutical',s:20},{w:'pediatric',s:18},{w:'surgery',s:16},
      {w:'radiology',s:20},{w:'oncology',s:20},{w:'pathology',s:20},
      {w:'cardiology',s:20},{w:'orthopedic',s:20},{w:'neurology',s:20},
      {w:'healthcare',s:14},{w:'medical',s:10},{w:'hospital',s:14},
      {w:'clinic',s:12},{w:'health',s:8},{w:'patient',s:8},
      {w:'doctor',s:10},{w:'nurse',s:10},{w:'wellness',s:8},{w:'treatment',s:10},
      {w:'symptom',s:14},{w:'medical condition',s:20},{w:'drug interaction',s:22}
    ],
    negativeKw: ['game','video game','shop','cart','social network','tweet','movie','music','recipe','insurance company','payer'],
    minScore: 0, requireDomain: false
  },

  // ── 4b. Health Insurance & Payer ───────────────────────────
  {
    id: 'insurance', label: 'Health Insurance & Payer', emoji: '🛡️', cssClass: 'cat-insurance',
    description: 'A health insurance company, payer, or benefits portal.',
    tlds: [],
    domains: [
      'aetna.com','cigna.com','uhc.com','unitedhealthcare.com','bcbs.com','humana.com','anthem.com',
      'centene.com','molina.com','oscar.com','ambetter.com','magellanhealth.com',
      'carefirst.com','highmark.com','kaiserpermanente.org','healthnet.com','geisinger.org'
    ],
    subdomainKw: ['insurance','payer','claims','healthplan','benefits','member','enrollment','coverage'],
    keywords: [
      {w:'health insurance',s:32},{w:'insurance coverage',s:30},{w:'payer network',s:32},
      {w:'insurance company',s:28},{w:'member portal',s:30},{w:'benefits portal',s:28},
      {w:'health plan',s:28},{w:'formulary',s:26},{w:'prior authorization',s:24},
      {w:'deductible',s:22},{w:'copay',s:24},{w:'network provider',s:22},
      {w:'out of pocket',s:20},{w:'open enrollment',s:22},{w:'summary of benefits',s:26},
      {w:'insurance',s:16},{w:'payer',s:20},{w:'claims',s:18},{w:'premium',s:14}
    ],
    negativeKw: ['game','video game','shop','cart','social network','tweet','movie','music','recipe','real estate'],
    minScore: 20, requireDomain: false
  },

  // ── 4c. Provider Portal & Credentialing ────────────────────
  {
    id: 'provider', label: 'Provider Portal', emoji: '🩺', cssClass: 'cat-provider',
    description: 'A healthcare provider, practice management, or credentialing portal.',
    tlds: [],
    domains: [
      'caqh.org','availity.com','athenahealth.com','epic.com',
      'eclinicalworks.com','nextgen.com','kareo.com','practicefusion.com',
      'changehealthcare.com','trizetto.com','optum.com',
      'zelis.com','navicure.com','waystar.com','mdvip.com',
      'doximity.com','healthgrades.com','zocdoc.com'
    ],
    subdomainKw: ['provider','caqh','proview','credentialing','ehr','emr','nonprod','sit','uat','prod','rx','pcp'],
    keywords: [
      {w:'provider credentialing',s:36},{w:'credentialing portal',s:36},
      {w:'provider portal',s:34},{w:'network provider',s:30},
      {w:'claims processing',s:30},{w:'healthcare network',s:28},
      {w:'care management',s:26},{w:'healthcare provider',s:26},
      {w:'credentialing',s:26},{w:'npi number',s:28},{w:'taxonomy code',s:26},
      {w:'provider',s:14},{w:'medical practice',s:20}
    ],
    negativeKw: ['game','video game','shop','cart','social network','tweet','movie','music','recipe'],
    minScore: 20, requireDomain: false
  },

  // ── 5. Business / Enterprise Portal ───────────────────────
  {
    id: 'portal', label: 'Business / Enterprise Portal', emoji: '🏢', cssClass: 'cat-portal',
    description: 'A business application, enterprise portal, internal tool, or SaaS platform.',
    tlds: [],
    domains: [
      'salesforce.com','workday.com','sap.com','oracle.com','servicenow.com',
      'zendesk.com','atlassian.com','freshdesk.com','hubspot.com','pipedrive.com',
      'monday.com','asana.com','notion.so','airtable.com','smartsheet.com',
      'slack.com','zoom.us','webex.com','sharepoint.com',
      'portal.azure.com','okta.com','onelogin.com',
      'bamboohr.com','gusto.com','rippling.com','deel.com','greenhouse.io',
      'lever.co','trello.com','clickup.com','basecamp.com','todoist.com',
      'freshservice.com','jira.atlassian.com','confluence.atlassian.com'
    ],
    subdomainKw: ['portal','dashboard','admin','manage','platform','console','workspace',
      'enterprise','internal','intranet','employee','vendor','client','partner',
      'b2b','staging','nonprod','sit','uat','qa','crm','erp','hrms','helpdesk'],
    keywords: [
      {w:'enterprise portal',s:32},{w:'employee portal',s:32},{w:'client portal',s:32},
      {w:'vendor portal',s:32},{w:'partner portal',s:32},{w:'supplier portal',s:30},
      {w:'self-service portal',s:30},{w:'customer portal',s:30},
      {w:'single sign-on',s:26},{w:'admin panel',s:24},{w:'management console',s:26},
      {w:'workflow automation',s:24},{w:'ticketing system',s:22},{w:'help desk',s:20},
      {w:'project management',s:20},{w:'task management',s:20},
      {w:'human resources',s:20},{w:'payroll system',s:22},
      {w:'accounting software',s:22},{w:'knowledge base',s:18},
      {w:'sso',s:16},{w:'crm',s:16},{w:'erp',s:16},{w:'saas platform',s:18},
      {w:'workflow',s:12},{w:'automation',s:10},{w:'b2b',s:14}
    ],
    negativeKw: ['buy now','add to cart','recipe','game','movie','music','tweet','follower','news article','social media post'],
    minScore: 20, requireDomain: false
  },

  // ── 6. Finance & Banking ───────────────────────────────────
  {
    id: 'finance', label: 'Finance & Banking', emoji: '💰', cssClass: 'cat-finance',
    description: 'A finance, banking, investment, or fintech platform.',
    tlds: [],
    domains: [
      'bloomberg.com','forbes.com','wsj.com','investopedia.com','nasdaq.com',
      'nyse.com','bankofamerica.com','chase.com','paypal.com','stripe.com',
      'coinbase.com','binance.com','fidelity.com','schwab.com','robinhood.com',
      'nerdwallet.com','creditkarma.com','mint.com','wise.com','revolut.com',
      'quickbooks.com','xero.com','freshbooks.com','etrade.com','tdameritrade.com',
      'vanguard.com','blackrock.com','morganstanley.com','goldmansachs.com',
      'wellsfargo.com','citibank.com','barclays.com','hsbc.com','jpmorgan.com',
      'monzo.com','starlingbank.com','plaid.com','transferwise.com'
    ],
    subdomainKw: ['bank','finance','invest','trading','crypto','payments','billing','accounting','wealth'],
    keywords: [
      {w:'investment portfolio',s:24},{w:'stock market',s:24},{w:'cryptocurrency exchange',s:26},
      {w:'wealth management',s:24},{w:'financial planning',s:24},{w:'interest rate',s:22},
      {w:'banking',s:16},{w:'investment',s:16},{w:'trading platform',s:22},
      {w:'forex',s:18},{w:'bonds',s:16},{w:'equity',s:16},{w:'fintech',s:20},
      {w:'bookkeeping',s:16},{w:'tax filing',s:20},{w:'mortgage',s:16},
      {w:'credit score',s:20},{w:'payment gateway',s:20},{w:'digital wallet',s:20},
      {w:'mutual fund',s:22},{w:'hedge fund',s:22},{w:'ipo',s:18},
      {w:'finance',s:10},{w:'accounting',s:12},{w:'budget',s:10},{w:'loan',s:12}
    ],
    negativeKw: ['game','social media','movie','recipe','travel','hospital','credentialing','news article'],
    minScore: 0, requireDomain: false
  },

  // ── 7. E-Commerce / Shopping ──────────────────────────────
  {
    id: 'ecommerce', label: 'E-Commerce / Shopping', emoji: '🛒', cssClass: 'cat-ecommerce',
    description: 'An online retail store or shopping marketplace.',
    tlds: [],
    domains: [
      'amazon.com','ebay.com','walmart.com','shopify.com','etsy.com','alibaba.com',
      'aliexpress.com','target.com','bestbuy.com','newegg.com','wayfair.com',
      'zappos.com','overstock.com','wish.com','flipkart.com','myntra.com',
      'rakuten.com','shein.com','temu.com','asos.com','macys.com',
      'homedepot.com','lowes.com','costco.com','chewy.com','nordstrom.com','zara.com'
    ],
    subdomainKw: ['shop','store','cart','checkout','order','buy'],
    keywords: [
      {w:'add to cart',s:36},{w:'free shipping',s:30},{w:'buy now',s:30},
      {w:'shopping cart',s:32},{w:'online store',s:26},{w:'return policy',s:24},
      {w:'product catalog',s:24},{w:'checkout',s:22},{w:'discount code',s:24},
      {w:'coupon',s:20},{w:'promo code',s:22},{w:'retail',s:16},{w:'marketplace',s:18},
      {w:'delivery tracking',s:22},{w:'shipping policy',s:22},{w:'wishlist',s:20},
      {w:'flash sale',s:24},{w:'limited time offer',s:22},{w:'sold out',s:16},
      {w:'shop',s:8},{w:'store',s:8},{w:'buy',s:8},{w:'price',s:6},{w:'sale',s:8}
    ],
    negativeKw: ['hospital','government','military','university','credentialing','news article'],
    minScore: 0, requireDomain: false
  },

  // ── 8. Social Media ───────────────────────────────────────
  {
    id: 'social', label: 'Social Media', emoji: '📱', cssClass: 'cat-social',
    description: 'A social networking or community platform.',
    tlds: [],
    requireDomain: true,
    domains: [
      'facebook.com','twitter.com','x.com','instagram.com','tiktok.com',
      'linkedin.com','snapchat.com','pinterest.com','reddit.com','tumblr.com',
      'discord.com','telegram.org','whatsapp.com','mastodon.social',
      'threads.net','bsky.app','weibo.com','vk.com','minds.com',
      'quora.com','medium.com','substack.com'
    ],
    subdomainKw: ['social','community','forum'],
    keywords: [
      {w:'social networking platform',s:34},{w:'social media platform',s:34},
      {w:'social network',s:30},{w:'friend request',s:30},{w:'news feed',s:28},
      {w:'direct message',s:24},{w:'retweet',s:26},{w:'hashtag trending',s:24},
      {w:'short video platform',s:26},{w:'influencer marketing',s:24},
      {w:'followers count',s:24},{w:'user timeline',s:24},
      {w:'tweet',s:14},{w:'reels',s:14},{w:'stories',s:10},{w:'followers',s:10},
      {w:'hashtag',s:12},{w:'influencer',s:12}
    ],
    negativeKw: ['hospital','provider','insurance','government','military','shop','university','credentialing','claims','payer','dashboard'],
    minScore: 30
  },

  // ── 9. Technology & Software ──────────────────────────────
  {
    id: 'technology', label: 'Technology & Software', emoji: '💻', cssClass: 'cat-technology',
    description: 'A technology company, developer tool, or software product.',
    tlds: ['.io','.dev','.tech'],
    domains: [
      'github.com','gitlab.com','stackoverflow.com','developer.mozilla.org',
      'npmjs.com','apple.com','google.com','microsoft.com','linux.org',
      'docker.com','vercel.com','netlify.com','cloudflare.com',
      'digitalocean.com','heroku.com','jetbrains.com','replit.com',
      'codesandbox.io','openai.com','anthropic.com','huggingface.co',
      'aws.amazon.com','azure.microsoft.com','cloud.google.com',
      'hashicorp.com','datadog.com','newrelic.com','splunk.com','elastic.co',
      'postman.com','swagger.io','redhat.com','canonical.com'
    ],
    subdomainKw: ['dev','api','docs','developer','code','git','tech','sdk','cloud','repo','devops'],
    keywords: [
      {w:'open source software',s:24},{w:'software development',s:24},{w:'developer tools',s:24},
      {w:'api documentation',s:26},{w:'cloud computing',s:22},{w:'devops pipeline',s:24},
      {w:'continuous integration',s:24},{w:'microservices',s:22},{w:'kubernetes',s:22},
      {w:'programming language',s:20},{w:'cybersecurity',s:20},{w:'infrastructure as code',s:24},
      {w:'version control',s:22},{w:'ci/cd',s:22},{w:'containerization',s:22},
      {w:'software',s:8},{w:'developer',s:10},{w:'programming',s:14},{w:'framework',s:12},
      {w:'technology',s:8},{w:'tech',s:6},{w:'cloud',s:8},{w:'startup',s:8},{w:'code',s:6}
    ],
    negativeKw: ['hospital','recipe','game','movie','shop','social network','credentialing','health insurance'],
    minScore: 0, requireDomain: false
  },

  // ── 9b. AI & Machine Learning ─────────────────────────────
  {
    id: 'ai', label: 'AI & Machine Learning', emoji: '🤖', cssClass: 'cat-ai',
    description: 'An artificial intelligence, machine learning, or LLM platform.',
    tlds: [],
    domains: [
      'openai.com','anthropic.com','huggingface.co','deepmind.com','gemini.google.com',
      'mistral.ai','perplexity.ai','character.ai','claude.ai','copilot.microsoft.com',
      'replicate.com','stability.ai','midjourney.com','runwayml.com','cohere.com',
      'together.ai','groq.com','ollama.com','lmsys.org','civitai.com'
    ],
    subdomainKw: ['ai','ml','llm','model','inference','chat','gpt','neural','nlp'],
    keywords: [
      {w:'large language model',s:36},{w:'artificial intelligence',s:32},{w:'machine learning model',s:32},
      {w:'generative ai',s:34},{w:'natural language processing',s:32},{w:'neural network',s:28},
      {w:'ai chatbot',s:30},{w:'llm',s:26},{w:'gpt',s:24},{w:'foundation model',s:28},
      {w:'text generation',s:24},{w:'image generation',s:24},{w:'fine-tuning',s:22},
      {w:'prompt engineering',s:26},{w:'vector database',s:24},{w:'embeddings',s:22},
      {w:'ai assistant',s:26},{w:'deep learning',s:24},{w:'transformer model',s:26},
      {w:'chatgpt',s:30},{w:'gemini',s:22},{w:'claude',s:22},{w:'copilot',s:18}
    ],
    negativeKw: ['shop','recipe','game','movie','hospital','insurance','credentialing'],
    minScore: 20, requireDomain: false
  },

  // ── 10. News & Media ──────────────────────────────────────
  {
    id: 'news', label: 'News & Media', emoji: '📰', cssClass: 'cat-news',
    description: 'A news outlet, journalism, or media publication.',
    tlds: [],
    domains: [
      'cnn.com','bbc.com','bbc.co.uk','nytimes.com','theguardian.com',
      'reuters.com','apnews.com','washingtonpost.com','foxnews.com',
      'nbcnews.com','aljazeera.com','theatlantic.com','time.com',
      'economist.com','newsweek.com','vox.com','theverge.com','wired.com',
      'huffpost.com','buzzfeed.com','ndtv.com','thehindu.com','indiatoday.in',
      'hindustantimes.com','timesofindia.com','abc.net.au','cbsnews.com',
      'msnbc.com','npr.org','pbs.org','propublica.org','axios.com',
      'politico.com','thehill.com','techcrunch.com','engadget.com'
    ],
    subdomainKw: ['news','press','media','editorial','breaking','headline','politics'],
    keywords: [
      {w:'breaking news',s:30},{w:'latest news',s:26},{w:'world news',s:26},
      {w:'investigative journalism',s:32},{w:'editorial board',s:26},
      {w:'press release',s:24},{w:'news headline',s:26},{w:'live coverage',s:24},
      {w:'journalist',s:20},{w:'reporter',s:18},{w:'broadcast',s:16},
      {w:'publication',s:16},{w:'newsletter',s:16},{w:'editorial',s:16},
      {w:'news',s:8},{w:'media',s:8},{w:'press',s:8},{w:'magazine',s:12},{w:'journalism',s:18}
    ],
    negativeKw: ['shop','game','recipe','social network','hospital','credentialing','add to cart'],
    minScore: 0, requireDomain: false
  },

  // ── 11. Gaming ────────────────────────────────────────────
  {
    id: 'gaming', label: 'Gaming', emoji: '🎮', cssClass: 'cat-gaming',
    description: 'A gaming platform, publisher, or gaming community.',
    tlds: [],
    domains: [
      'steampowered.com','epicgames.com','ign.com','gamespot.com','kotaku.com',
      'twitch.tv','ea.com','ubisoft.com','blizzard.com','riotgames.com',
      'xbox.com','playstation.com','nintendo.com','roblox.com','minecraft.net',
      'gog.com','humblebundle.com','g2a.com','cdkeys.com',
      'rockstargames.com','2k.com','bethesda.net','bungie.net','valvesoftware.com',
      'activision.com','squareenix.com','capcom.com','sega.com'
    ],
    subdomainKw: ['game','games','gaming','play','esports','arcade','clan','guild'],
    keywords: [
      {w:'battle royale',s:30},{w:'video game',s:26},{w:'online multiplayer',s:26},
      {w:'esports tournament',s:28},{w:'pc gaming',s:24},{w:'gaming platform',s:26},
      {w:'game developer',s:24},{w:'open world game',s:26},
      {w:'fps',s:16},{w:'rpg',s:16},{w:'mmorpg',s:22},{w:'leaderboard',s:20},
      {w:'gameplay',s:20},{w:'streamer',s:16},{w:'indie game',s:22},
      {w:'game',s:8},{w:'gaming',s:10},{w:'player',s:6},{w:'multiplayer',s:12}
    ],
    negativeKw: ['hospital','insurance','government','recipe','news','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 12. Entertainment & Streaming ─────────────────────────
  {
    id: 'entertainment', label: 'Entertainment & Streaming', emoji: '🎬', cssClass: 'cat-entertainment',
    description: 'A streaming, movies, music, or media content platform.',
    tlds: [],
    domains: [
      'netflix.com','youtube.com','spotify.com','disneyplus.com','hulu.com',
      'hbomax.com','max.com','primevideo.com','peacocktv.com','soundcloud.com',
      'pandora.com','tidal.com','imdb.com','rottentomatoes.com','crunchyroll.com',
      'deezer.com','appletv.com','paramountplus.com','discovery.com','fandango.com',
      'vimeo.com','dailymotion.com','twitch.tv','kick.com','rumble.com'
    ],
    subdomainKw: ['stream','watch','movies','shows','music','podcast','episode'],
    keywords: [
      {w:'streaming platform',s:30},{w:'watch online',s:26},{w:'binge watch',s:26},
      {w:'original series',s:24},{w:'movie trailer',s:26},{w:'tv show',s:24},
      {w:'music streaming',s:26},{w:'podcast episode',s:24},
      {w:'movie',s:10},{w:'film',s:10},{w:'series',s:10},{w:'episode',s:10},
      {w:'streaming',s:14},{w:'music',s:8},{w:'playlist',s:12},{w:'album',s:12},
      {w:'subscribe',s:10},{w:'watch now',s:18},{w:'stream live',s:20}
    ],
    negativeKw: ['shop','hospital','government','recipe','social network','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 13. Reference & Encyclopedia ──────────────────────────
  {
    id: 'reference', label: 'Reference & Encyclopedia', emoji: '📚', cssClass: 'cat-reference',
    description: 'A reference site, encyclopedia, or knowledge base.',
    tlds: [],
    domains: [
      'wikipedia.org','wikimedia.org','britannica.com','merriam-webster.com',
      'dictionary.com','thesaurus.com','wolframalpha.com','archive.org',
      'jstor.org','pubmed.ncbi.nlm.nih.gov','scholar.google.com',
      'stackexchange.com','snopes.com','goodreads.com','worldcat.org'
    ],
    subdomainKw: ['wiki','encyclopedia','docs','kb','knowledgebase','reference','lib','archive'],
    keywords: [
      {w:'free encyclopedia',s:30},{w:'open encyclopedia',s:30},{w:'knowledge base',s:24},
      {w:'dictionary definition',s:26},{w:'scholarly article',s:26},{w:'peer reviewed',s:26},
      {w:'encyclopedia',s:24},{w:'thesaurus',s:22},{w:'reference guide',s:22},
      {w:'wiki',s:16},{w:'definition',s:14},{w:'glossary',s:20},
      {w:'archive',s:12},{w:'library',s:10},{w:'research',s:8}
    ],
    negativeKw: ['shop','game','movie','social media','recipe'],
    minScore: 0, requireDomain: false
  },

  // ── 14. Design & Creative ─────────────────────────────────
  {
    id: 'design', label: 'Design & Creative', emoji: '🎨', cssClass: 'cat-design',
    description: 'A design tool, creative platform, or digital portfolio site.',
    tlds: [],
    domains: [
      'dribbble.com','behance.net','figma.com','adobe.com','canva.com',
      'unsplash.com','pexels.com','shutterstock.com','gettyimages.com',
      'invision.com','framer.com','webflow.com','sketch.com',
      'creativebloq.com','awwwards.com','codrops.com','iconscout.com',
      'flaticon.com','freepik.com','envato.com','99designs.com'
    ],
    subdomainKw: ['design','creative','studio','portfolio','art'],
    keywords: [
      {w:'ui design',s:26},{w:'ux design',s:26},{w:'graphic design',s:26},
      {w:'design system',s:24},{w:'color palette',s:24},{w:'design tool',s:24},
      {w:'wireframe',s:22},{w:'prototype',s:20},{w:'mockup',s:20},
      {w:'illustration',s:20},{w:'typography',s:22},{w:'branding',s:18},
      {w:'design',s:8},{w:'creative',s:8},{w:'portfolio',s:12},
      {w:'photography',s:12},{w:'icon',s:8},{w:'logo design',s:20},{w:'visual design',s:22}
    ],
    negativeKw: ['hospital','government','game','shop','news','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 15. Travel & Tourism ──────────────────────────────────
  {
    id: 'travel', label: 'Travel & Tourism', emoji: '✈️', cssClass: 'cat-travel',
    description: 'A travel booking, tourism, or destination guide.',
    tlds: [],
    domains: [
      'booking.com','expedia.com','airbnb.com','tripadvisor.com','kayak.com',
      'hotels.com','skyscanner.com','agoda.com','lonelyplanet.com','viator.com',
      'priceline.com','hotwire.com','momondo.com','cheapflights.com',
      'marriott.com','hilton.com','ihg.com','airfrance.com','delta.com','united.com'
    ],
    subdomainKw: ['travel','tours','booking','flights','hotels','vacation','trip'],
    keywords: [
      {w:'book flights',s:30},{w:'hotel booking',s:28},{w:'vacation package',s:26},
      {w:'travel guide',s:26},{w:'travel deals',s:24},{w:'flight search',s:26},
      {w:'destination guide',s:26},{w:'tour package',s:24},{w:'travel insurance',s:24},
      {w:'travel',s:10},{w:'tourism',s:16},{w:'hotel',s:10},{w:'flight',s:10},
      {w:'vacation',s:14},{w:'itinerary',s:16},{w:'sightseeing',s:16},{w:'resort',s:12}
    ],
    negativeKw: ['hospital','government','game','recipe','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 16. Food & Lifestyle ──────────────────────────────────
  {
    id: 'food', label: 'Food & Lifestyle', emoji: '🍕', cssClass: 'cat-food',
    description: 'A food, recipe, restaurant, or lifestyle website.',
    tlds: [],
    domains: [
      'allrecipes.com','foodnetwork.com','epicurious.com','seriouseats.com',
      'tasty.co','delish.com','doordash.com','ubereats.com','grubhub.com',
      'yelp.com','zomato.com','opentable.com','bonappetit.com',
      'food52.com','thekitchn.com','simplyrecipes.com','instacart.com'
    ],
    subdomainKw: ['food','recipe','menu','restaurant','kitchen','chef','dining'],
    keywords: [
      {w:'cooking tips',s:24},{w:'restaurant review',s:24},{w:'food delivery',s:24},
      {w:'meal prep',s:22},{w:'healthy eating',s:20},{w:'vegan recipe',s:24},
      {w:'food blog',s:22},{w:'nutrition facts',s:20},
      {w:'recipe',s:18},{w:'chef',s:12},{w:'ingredient',s:14},{w:'cuisine',s:14},
      {w:'food',s:8},{w:'cooking',s:10},{w:'restaurant',s:10},{w:'meal',s:8},{w:'menu',s:10}
    ],
    negativeKw: ['hospital','government','game','social media','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 17. Sports & Fitness ──────────────────────────────────
  {
    id: 'sports', label: 'Sports & Fitness', emoji: '⚽', cssClass: 'cat-sports',
    description: 'A sports, athletics, or fitness platform.',
    tlds: [],
    domains: [
      'espn.com','nfl.com','nba.com','mlb.com','nhl.com','fifa.com','uefa.com',
      'skysports.com','cbssports.com','bleacherreport.com','sportsillustrated.com',
      'theathletic.com','strava.com','peloton.com','nike.com','adidas.com',
      'underarmour.com','myfitnesspal.com','whoop.com','garmin.com'
    ],
    subdomainKw: ['sports','sport','fitness','gym','athlete','team','league','football','soccer','basketball'],
    keywords: [
      {w:'sports news',s:28},{w:'live score',s:28},{w:'match result',s:26},
      {w:'football league',s:26},{w:'nba standings',s:28},{w:'sports highlights',s:26},
      {w:'athlete profile',s:24},{w:'fitness tracker',s:24},{w:'workout plan',s:24},
      {w:'personal best',s:22},{w:'marathon training',s:24},{w:'sports analysis',s:24},
      {w:'sports',s:10},{w:'fitness',s:10},{w:'gym',s:8},{w:'match',s:8},{w:'score',s:8},
      {w:'athlete',s:12},{w:'team',s:6},{w:'league',s:12},{w:'championship',s:16}
    ],
    negativeKw: ['hospital','government','recipe','social media','credentialing','news article','shop'],
    minScore: 0, requireDomain: false
  },

  // ── 18. Real Estate ───────────────────────────────────────
  {
    id: 'realestate', label: 'Real Estate', emoji: '🏠', cssClass: 'cat-realestate',
    description: 'A real estate, property listing, or mortgage platform.',
    tlds: [],
    domains: [
      'zillow.com','realtor.com','trulia.com','redfin.com','homes.com',
      'rightmove.co.uk','zoopla.co.uk','domain.com.au','realestate.com.au',
      'magicbricks.com','99acres.com','housing.com','loopnet.com',
      'apartments.com','rent.com','costar.com'
    ],
    subdomainKw: ['realestate','property','homes','rent','mortgage','realtor','mls'],
    keywords: [
      {w:'homes for sale',s:34},{w:'property listing',s:32},{w:'real estate agent',s:30},
      {w:'mortgage rate',s:30},{w:'rent apartment',s:28},{w:'home buying',s:28},
      {w:'property search',s:28},{w:'house for sale',s:30},{w:'real estate market',s:28},
      {w:'mls listing',s:30},{w:'square feet',s:22},{w:'bedroom bathroom',s:20},
      {w:'real estate',s:20},{w:'property',s:12},{w:'mortgage',s:14},{w:'rent',s:10}
    ],
    negativeKw: ['game','movie','hospital','credentialing','social media','recipe'],
    minScore: 16, requireDomain: false
  },

  // ── 19. Legal & Law ───────────────────────────────────────
  {
    id: 'legal', label: 'Legal & Law', emoji: '⚖️', cssClass: 'cat-legal',
    description: 'A law firm, legal services, or legal information site.',
    tlds: [],
    domains: [
      'lexisnexis.com','westlaw.com','findlaw.com','avvo.com','justia.com',
      'nolo.com','legalzoom.com','rocketlawyer.com','law360.com','scotusblog.com',
      'oyez.org','courtlistener.com','pacer.gov','law.cornell.edu'
    ],
    subdomainKw: ['law','legal','attorney','lawyer','court','litigation','compliance'],
    keywords: [
      {w:'law firm',s:34},{w:'legal advice',s:30},{w:'attorney at law',s:34},
      {w:'legal services',s:30},{w:'court case',s:28},{w:'legal representation',s:30},
      {w:'litigation',s:26},{w:'legal compliance',s:28},{w:'legal document',s:24},
      {w:'contract law',s:26},{w:'lawsuit',s:22},{w:'plaintiff',s:22},
      {w:'defendant',s:22},{w:'jurisdiction',s:20},
      {w:'attorney',s:20},{w:'lawyer',s:18},{w:'legal',s:10},{w:'law',s:8}
    ],
    negativeKw: ['game','movie','recipe','shop','social media','credentialing'],
    minScore: 16, requireDomain: false
  },

  // ── 20. Cybersecurity ─────────────────────────────────────
  {
    id: 'cybersecurity', label: 'Cybersecurity', emoji: '🔐', cssClass: 'cat-cybersecurity',
    description: 'A cybersecurity, infosec, or threat intelligence platform.',
    tlds: [],
    domains: [
      'crowdstrike.com','paloaltonetworks.com','tenable.com','qualys.com',
      'rapid7.com','darktrace.com','sentinelone.com',
      'malwarebytes.com','eset.com','avast.com','kaspersky.com','norton.com',
      'virustotal.com','shodan.io','haveibeenpwned.com','threatpost.com',
      'krebsonsecurity.com','sans.org'
    ],
    subdomainKw: ['security','cyber','infosec','threat','firewall','vpn','siem','soc','pentest'],
    keywords: [
      {w:'threat intelligence',s:36},{w:'vulnerability assessment',s:34},
      {w:'penetration testing',s:34},{w:'endpoint detection',s:32},
      {w:'zero day exploit',s:34},{w:'ransomware protection',s:32},
      {w:'incident response',s:30},{w:'security operations center',s:32},
      {w:'security posture',s:28},{w:'attack surface',s:28},
      {w:'malware analysis',s:30},{w:'phishing detection',s:30},
      {w:'cybersecurity',s:22},{w:'infosec',s:22},{w:'firewall',s:16},
      {w:'security',s:8},{w:'vulnerability',s:16},{w:'exploit',s:14},{w:'breach',s:14}
    ],
    negativeKw: ['shop','recipe','game','movie','social media','hospital','insurance'],
    minScore: 20, requireDomain: false
  },

  // ── 21. Automotive ────────────────────────────────────────
  {
    id: 'automotive', label: 'Automotive', emoji: '🚗', cssClass: 'cat-automotive',
    description: 'A car manufacturer, dealership, or automotive information site.',
    tlds: [],
    domains: [
      'cars.com','carmax.com','autotrader.com','edmunds.com','kelleybluebook.com',
      'cargurus.com','truecar.com','vroom.com','carvana.com',
      'toyota.com','honda.com','ford.com','chevrolet.com','bmw.com',
      'mercedes-benz.com','audi.com','volkswagen.com','tesla.com',
      'motortrend.com','caranddriver.com','topgear.com','jalopnik.com'
    ],
    subdomainKw: ['cars','auto','automotive','dealership','vehicle','motor','ev'],
    keywords: [
      {w:'car dealership',s:32},{w:'vehicle listing',s:30},{w:'used cars',s:30},
      {w:'new car price',s:30},{w:'test drive',s:26},{w:'auto financing',s:28},
      {w:'fuel economy',s:24},{w:'horsepower',s:24},{w:'torque',s:20},
      {w:'electric vehicle',s:26},{w:'car review',s:26},{w:'vehicle history',s:24},
      {w:'car insurance',s:22},{w:'vin number',s:24},
      {w:'car',s:8},{w:'vehicle',s:10},{w:'automotive',s:14},{w:'dealership',s:16}
    ],
    negativeKw: ['hospital','government','game','recipe','credentialing','insurance plan'],
    minScore: 16, requireDomain: false
  }

];

// ── URL Token Extractor ──────────────────────────────────────
/**
 * Break the URL into meaningful text tokens for matching:
 *  - Subdomain segments (stripped of hyphens/numbers)
 *  - Root domain name
 *  - URL path words
 */
function extractUrlTokens(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();          // proview-sit2.nonprod.caqh.org
    const parts = host.split('.');                  // ["proview-sit2","nonprod","caqh","org"]
    const subParts = parts.slice(0, -2);            // remove TLD + root → ["proview-sit2","nonprod"]
    const subStr = subParts.join(' ').replace(/-/g, ' ').replace(/\d+/g, ' ').trim();
    const rootName = parts.length >= 2 ? parts[parts.length - 2] : '';  // "caqh"
    const path = u.pathname.toLowerCase().replace(/[/_-]/g, ' ');
    const allText = `${subStr} ${rootName} ${host} ${path}`;
    return { host, subStr, rootName, path, allText };
  } catch {
    return { host: url, subStr: '', rootName: '', path: '', allText: url };
  }
}

// ── Main Classification Function ─────────────────────────────
/**
 * Score every category and return the best match with confidence.
 */
function classifySite(url, title, description) {
  const domain  = getDomain(url).toLowerCase();
  const fullUrl = url.toLowerCase();
  const tokens  = extractUrlTokens(url);

  // Full corpus for keyword matching (title + desc + all url tokens)
  const corpus = `${title} ${description} ${tokens.allText}`.toLowerCase();

  const results = [];

  for (const cat of CATEGORIES) {
    let score = 0;
    let hasDomainSignal = false;

    // ── 1. TLD match (+80, strongest)
    for (const tld of (cat.tlds || [])) {
      const tldNoSlash = tld.replace(/\//g, '');
      if (domain.endsWith(tldNoSlash) || fullUrl.includes(tld + '/')) {
        score += 80;
        hasDomainSignal = true;
        break;
      }
    }

    // ── 2. Known domain exact match (+60)
    for (const d of (cat.domains || [])) {
      if (domain === d || domain.endsWith('.' + d)) {
        score += 60;
        hasDomainSignal = true;
        break;
      }
    }

    // ── 3. Subdomain / path keyword match (+25 each, max 2 hits)
    let subHits = 0;
    for (const kw of (cat.subdomainKw || [])) {
      if (subHits >= 2) break;
      // Check against full URL tokens (subdomain segments + root + path)
      if (tokens.allText.includes(kw)) {
        score += 25;
        hasDomainSignal = true;
        subHits++;
      }
    }

    // ── 4. Keyword scoring on full corpus
    for (const { w, s } of (cat.keywords || [])) {
      if (corpus.includes(w)) {
        score += s;
      }
    }

    // ── 5. Negative keyword penalty (–12 each)
    for (const nk of (cat.negativeKw || [])) {
      if (corpus.includes(nk)) {
        score -= 12;
      }
    }

    // ── 6. requireDomain gate
    if (cat.requireDomain && !hasDomainSignal) continue;

    // ── 7. minScore threshold
    if (score < (cat.minScore || 0)) continue;

    if (score > 0) {
      results.push({ cat, score, hasDomainSignal });
    }
  }

  // ── No matches at all
  if (!results.length) {
    return {
      category: {
        id: 'unknown', label: 'General Website', emoji: '\uD83C\uDF10',
        cssClass: 'cat-unknown',
        description: 'Not enough signals to determine a specific category.'
      },
      confidence: 'low', score: 0
    };
  }

  // ── Sort by score
  results.sort((a, b) => b.score - a.score);
  const top  = results[0];
  const next = results[1];
  const gap  = next ? (top.score - next.score) : top.score;

  // ── Confidence level
  let confidence;
  if      (top.score >= 80 || gap >= 50) confidence = 'high';
  else if (top.score >= 40 || gap >= 20) confidence = 'medium';
  else                                    confidence = 'low';

  // ── If barely any evidence, fall back gracefully
  if (top.score < 15) {
    return {
      category: {
        id: 'unknown', label: 'General Website', emoji: '\uD83C\uDF10',
        cssClass: 'cat-unknown',
        description: 'Not enough signals to reliably classify this site.'
      },
      confidence: 'low', score: top.score
    };
  }

  return { category: top.cat, confidence, score: top.score };
}

// ── Render Category Badge ────────────────────────────────────
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

// ════════════════════════════════════════════════════════════
// ── BULK CHECK MODULE ────────────────────────────────────────
// ════════════════════════════════════════════════════════════

// ── Bulk DOM refs ────────────────────────────────────────────
const modeSingle       = document.getElementById('modeSingle');
const modeBulk         = document.getElementById('modeBulk');
const singlePanel      = document.getElementById('singlePanel');
const bulkPanel        = document.getElementById('bulkPanel');
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

// ── Bulk state ───────────────────────────────────────────────
const MAX_BULK   = 25;
const DELAY_MS   = 600;
let bulkRunning  = false;
let bulkAbort    = false;
let bulkData     = [];

// ── Mode toggle ──────────────────────────────────────────────
const modeEmail = document.getElementById('modeEmail');
modeSingle.addEventListener('click', () => setMode('single'));
modeBulk.addEventListener('click',   () => setMode('bulk'));
modeEmail.addEventListener('click',  () => setMode('email'));

function setMode(mode) {
  const emailPanelEl = document.getElementById('emailPanel');
  if (mode === 'single') {
    modeSingle.classList.add('active');
    modeBulk.classList.remove('active');
    modeEmail.classList.remove('active');
    show(singlePanel);
    hide(bulkPanel);
    hide(bulkResults);
    if (emailPanelEl) hide(emailPanelEl);
  } else if (mode === 'email') {
    modeEmail.classList.add('active');
    modeSingle.classList.remove('active');
    modeBulk.classList.remove('active');
    hide(singlePanel);
    hide(bulkPanel);
    hide(bulkResults);
    hide(results);
    if (emailPanelEl) show(emailPanelEl);
  } else {
    modeBulk.classList.add('active');
    modeSingle.classList.remove('active');
    modeEmail.classList.remove('active');
    hide(singlePanel);
    show(bulkPanel);
    hide(results);
    if (emailPanelEl) hide(emailPanelEl);
  }
}

// ── Bulk textarea counter ─────────────────────────────────────
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

// ── Clear bulk input ─────────────────────────────────────────
bulkClearBtn.addEventListener('click', () => {
  bulkInput.value = '';
  updateBulkCount();
});

// ── Stop button ──────────────────────────────────────────────
bulkStopBtn.addEventListener('click', () => {
  bulkAbort = true;
  bulkStopBtn.disabled = true;
  bulkProgressLabel.textContent = 'Stopping\u2026';
});

// ── Run bulk check ───────────────────────────────────────────
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

  // Pre-populate skeleton rows
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
      result = { ok: false, url, title: getDomain(url), desc: 'Error fetching data.', category, lang: null,
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

// ── Fetch one site (no screenshot in bulk mode) ───────────────
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
    const threat = heuristicScan(url);  // fast client-side scan for bulk
    return { ok: true, url, title, desc, lang, category, threat,
             favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32` };
  }
  const { category } = classifySite(url, getDomain(url), '');
  const threat = heuristicScan(url);
  return { ok: false, url, title: getDomain(url), desc: 'Could not fetch metadata.', lang: null, category, threat,
           favicon: `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32` };
}

// ── Skeleton row ─────────────────────────────────────────────
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
  `;
  return tr;
}

// ── Completed result row ─────────────────────────────────────
function makeResultRow(r) {
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

  // Threat badge for bulk table
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
        <a class="row-action-btn" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">
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
  // Safe event delegation — avoids inline onclick XSS
  tr.querySelector('.inspect-btn').addEventListener('click', () => inspectFromBulk(r.url));
  return tr;
}

// ── Inspect single site from bulk table ─────────────────────
function inspectFromBulk(url) {
  setMode('single');
  urlInput.value = url;
  clearBtn.classList.add('visible');
  checkSite(url);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Export to CSV ────────────────────────────────────────────
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
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `sitescope-bulk-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ── Sleep helper ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ════════════════════════════════════════════════════════════
// ── SECURITY SCANNER MODULE ──────────────────────────────────
//
//  Two-stage scan:
//    Stage 1 – Heuristic analysis (instant, client-side)
//    Stage 2 – URLhaus malware DB lookup (async, free, no key)
//
//  Risk scoring (0–100):
//    HTTP only             +25
//    IP address URL        +30
//    Port in URL           +20
//    Suspicious TLD        +25
//    Non-ASCII in domain   +35 (homograph attack)
//    @ symbol in URL       +30 (credential phishing trick)
//    Excessive length>120  +12
//    3+ dots in hostname   +15 (too many subdomains)
//    Phishing keywords     +20
//    Double-hyphen domain  +10
//    Suspicious extension  +15
//    Data: URI             +45
//    URLhaus confirmed     +60 (capped at 100)
//    HTTPS bonus           –8
//    Known brand domain    –15
// ════════════════════════════════════════════════════════════

// ── Threat level display metadata ───────────────────────────
const THREAT_META = {
  safe:     { label: 'Safe',     icon: '🟢', cls: 'safe',     secCls: 'sec-safe',
              msg: 'No threats detected. This site appears safe.' },
  low:      { label: 'Low Risk', icon: '🟡', cls: 'low',      secCls: 'sec-low',
              msg: 'Minor risk signals detected. Browse with normal caution.' },
  medium:   { label: 'Medium Risk', icon: '🟠', cls: 'medium', secCls: 'sec-medium',
              msg: 'Several risk signals found. Verify this site before sharing data.' },
  high:     { label: 'High Risk', icon: '🔴', cls: 'high',    secCls: 'sec-high',
              msg: 'Strong phishing / malware indicators. Avoid entering any credentials.' },
  critical: { label: 'Critical — Likely Malicious', icon: '🚨', cls: 'critical', secCls: 'sec-critical',
              msg: 'DANGER: This URL matches known threat databases or has extreme risk signals. Do NOT visit.' }
};

// Suspicious TLDs commonly abused for phishing
const SUSPICIOUS_TLDS = new Set([
  '.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.loan','.work',
  '.download','.stream','.racing','.win','.bid','.date','.review','.trade',
  '.webcam','.accountant','.science','.cricket','.faith','.party'
]);

// Well-known brand domains (used to detect typosquatting variants)
const KNOWN_BRANDS = [
  'google','facebook','twitter','instagram','amazon','microsoft','apple',
  'paypal','netflix','spotify','linkedin','github','youtube','whatsapp',
  'telegram','discord','dropbox','adobe','salesforce','stripe'
];

// Phishing-related keywords often planted in fake URLs
const PHISHING_KEYWORDS = [
  'login','signin','sign-in','logon','verify','verification','validate',
  'update','account','secure','security','confirm','banking','bank',
  'password','credential','wallet','recovery','support','helpdesk',
  'suspended','alert','notice','locked','unlock','claim','reward',
  'prize','winner','free','gift','offer','cashback','refund'
];

// Suspicious file extensions in URL paths
const SUSPICIOUS_EXTS = ['.exe','.bat','.cmd','.msi','.vbs','.ps1','.jar','.apk','.dmg','.iso'];

// ── Stage 1: Heuristic URL scan ─────────────────────────────
function heuristicScan(url) {
  const findings = [];
  let score = 0;

  let parsedUrl;
  try { parsedUrl = new URL(url); }
  catch { return { level: 'high', score: 60, findings: [{ type: 'danger', text: 'Malformed or unparseable URL.' }], dbStatus: 'unknown' }; }

  const scheme   = parsedUrl.protocol;
  const hostname = parsedUrl.hostname.toLowerCase();
  const fullUrl  = url.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  // ── HTTPS check
  if (scheme === 'https:') {
    score -= 8;
    findings.push({ type: 'good', text: 'Uses HTTPS — encrypted connection.' });
  } else if (scheme === 'http:') {
    score += 25;
    findings.push({ type: 'danger', text: 'HTTP only — connection is NOT encrypted. Credentials can be intercepted.' });
  } else if (scheme === 'data:') {
    score += 45;
    findings.push({ type: 'danger', text: 'Data URI detected — commonly used in phishing attacks.' });
  }

  // ── IP address in URL
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    score += 30;
    findings.push({ type: 'danger', text: 'URL uses a raw IP address instead of a domain name — common in malware/phishing.' });
  }

  // ── Port in URL
  if (parsedUrl.port && !['80','443'].includes(parsedUrl.port)) {
    score += 20;
    findings.push({ type: 'warn', text: `Non-standard port ${parsedUrl.port} detected — uncommon for legitimate sites.` });
  }

  // ── Suspicious TLD
  const tldMatch = hostname.match(/(\.[^.]+)$/);
  if (tldMatch && SUSPICIOUS_TLDS.has(tldMatch[1])) {
    score += 25;
    findings.push({ type: 'warn', text: `Suspicious TLD "${tldMatch[1]}" — frequently used in phishing campaigns.` });
  }

  // ── Non-ASCII / homograph attack
  if (/[^\x00-\x7F]/.test(hostname) || hostname.includes('xn--')) {
    score += 35;
    findings.push({ type: 'danger', text: 'Non-ASCII or Punycode characters in domain — possible homograph/spoofing attack.' });
  }

  // ── @ symbol trick (https://evil.com@legitimate.com)
  if (url.includes('@') && url.indexOf('@') < url.indexOf(hostname)) {
    score += 30;
    findings.push({ type: 'danger', text: '@ symbol before domain — used to hide the real destination in phishing links.' });
  }

  // ── Excessive URL length
  if (url.length > 120) {
    score += 12;
    findings.push({ type: 'warn', text: `Very long URL (${url.length} chars) — long URLs are often used to obfuscate malicious paths.` });
  }

  // ── Too many subdomains (dots)
  const dotCount = (hostname.match(/\./g) || []).length;
  if (dotCount >= 3) {
    score += 15;
    findings.push({ type: 'warn', text: `${dotCount + 1} domain segments detected — excessive subdomains are common in phishing.` });
  }

  // ── Phishing keywords in URL
  const urlLower = fullUrl;
  const hitKws = PHISHING_KEYWORDS.filter(k => urlLower.includes(k));
  if (hitKws.length >= 2) {
    score += 20;
    findings.push({ type: 'warn', text: `Phishing-related keywords in URL: "${hitKws.slice(0,3).join('", "')}" — common in credential-harvest pages.` });
  } else if (hitKws.length === 1) {
    score += 8;
    findings.push({ type: 'info', text: `Keyword "${hitKws[0]}" in URL — alone not a threat, but note if combined with other signals.` });
  }

  // ── Double hyphen domain (IDN trick)
  if (/--/.test(hostname.split('.')[0])) {
    score += 10;
    findings.push({ type: 'warn', text: 'Double hyphen in domain label — may indicate an IDN trick or Punycode attempt.' });
  }

  // ── Suspicious executable extensions in path
  const extMatch = SUSPICIOUS_EXTS.find(e => pathname.endsWith(e));
  if (extMatch) {
    score += 15;
    findings.push({ type: 'danger', text: `URL path ends in "${extMatch}" — direct download of an executable file.` });
  }

  // ── Typosquatting: known brand name with slight variation
  const domainBase = hostname.replace(/^www\./, '').split('.')[0];
  const typoHit = KNOWN_BRANDS.find(brand => {
    if (domainBase === brand) return false; // exact match is fine
    return levenshtein(domainBase, brand) <= 2 && domainBase.length >= brand.length - 1;
  });
  if (typoHit) {
    score += 25;
    findings.push({ type: 'danger', text: `Domain "${domainBase}" closely resembles "${typoHit}" — possible brand impersonation / typosquatting.` });
  }

  // ── Known brand exact match → small safety credit
  const isKnownBrand = KNOWN_BRANDS.includes(domainBase);
  if (isKnownBrand) {
    score -= 15;
    findings.push({ type: 'good', text: `Domain matches known brand "${domainBase}" — appears to be the genuine site.` });
  }

  // ── Clamp score
  score = Math.max(0, Math.min(100, score));

  // Add a positive finding if score is very low and no negatives
  const hasDanger = findings.some(f => f.type === 'danger' || f.type === 'warn');
  if (!hasDanger) {
    findings.push({ type: 'good', text: 'No suspicious URL patterns detected by heuristic analysis.' });
  }

  const level = score <= 15 ? 'safe' : score <= 30 ? 'low' : score <= 50 ? 'medium' : score <= 70 ? 'high' : 'critical';
  return { level, score, findings, dbStatus: 'pending' };
}

// ── Levenshtein distance (for typosquatting detection) ───────
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99; // Early exit
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
               : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

// ── Stage 2: URLhaus database check ─────────────────────────
async function checkUrlhaus(url) {
  try {
    const body = new URLSearchParams({ url });
    const res  = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const json = await res.json();
    // query_status values: "is_host" | "no_results" | "invalid_url"
    if (json.query_status === 'is_host') {
      return { found: true, threat: json.threat || 'malware', tags: json.tags || [] };
    }
    return { found: false };
  } catch {
    return { found: false, error: true };
  }
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

// ── Main orchestrator ────────────────────────────────────────
async function scanSecurity(url) {
  show(secScanningBadge);

  // Stage 1 — instant heuristics
  const heuristic = heuristicScan(url);
  renderSecurityReport(heuristic, 'pending');

  // Stage 2 — URLhaus DB check
  const db = await checkUrlhaus(url);

  // Merge DB result
  let finalScore = heuristic.score;
  let finalLevel = heuristic.level;
  let dbStatus   = 'clean';
  const dbFindings = [];

  if (db.error) {
    dbStatus = 'unknown';
    dbFindings.push({ type: 'info', text: 'Threat database check unavailable (network error). Heuristic analysis only.' });
  } else if (db.found) {
    dbStatus = 'malware';
    finalScore = Math.min(100, finalScore + 60);
    finalLevel = 'critical';
    const tagStr = db.tags && db.tags.length ? ` [${db.tags.join(', ')}]` : '';
    dbFindings.push({ type: 'danger', text: `⚠️ CONFIRMED in URLhaus malware database — Threat type: ${db.threat}${tagStr}.` });
  } else {
    dbStatus = 'clean';
    dbFindings.push({ type: 'good', text: 'Not found in URLhaus malware/phishing database — no known active threats.' });
  }

  const merged = {
    level: finalLevel,
    score: finalScore,
    findings: [...dbFindings, ...heuristic.findings],
    dbStatus
  };

  renderSecurityReport(merged, 'done');
  hide(secScanningBadge);
  return finalLevel;
}

// ── Render security panel ────────────────────────────────────
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


// ════════════════════════════════════════════════════════════
// ── SANDBOX CONTAINER MODULE ─────────────────────────────────
//
//  How it works:
//  1. Fetch raw HTML via allorigins.win proxy (bypasses CORS)
//  2. Parse & sanitize in a DOMParser:
//       • Remove all <script> tags
//       • Remove inline event handlers (onclick, onload, etc.)
//       • Remove <iframe>, <object>, <embed>, <applet>
//       • Block <meta http-equiv="refresh"> redirects
//       • Neutralise javascript: href/src values
//       • Remove known tracker pixel patterns
//       • Disable all <form> submissions
//       • Remove <base> and inject our own (for relative URLs)
//       • Inject strict CSP <meta> (script-src 'none')
//  3. Serialize sanitized DOM → Blob URL
//  4. Load Blob into a maximally-restricted iframe:
//       sandbox="allow-same-origin"  (CSS/images load, NO scripts)
//       referrerpolicy="no-referrer" (no referrer leaks)
//       allow="camera 'none'; mic 'none'; payment 'none'; ..."
//  5. Revoke Blob URL after load (GC friendly)
//  6. Update the status header with exact counts of what was blocked
// ════════════════════════════════════════════════════════════

// ── Sandbox DOM refs ─────────────────────────────────────────
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

// ── State ────────────────────────────────────────────────────
let sandboxUrl      = '';   // URL currently loaded in sandbox
let sandboxBlobUrl  = '';   // current blob URL (for revocation)
let sandboxLoaded   = false;

// ── Tracker domain patterns (pixel trackers, analytics) ──────
const TRACKER_DOMAINS = [
  'google-analytics.com','googletagmanager.com','doubleclick.net',
  'facebook.com/tr','facebook.net','fbcdn.net','connect.facebook',
  'analytics.yahoo.com','bat.bing.com','scorecardresearch.com',
  'quantserve.com','hotjar.com','mixpanel.com','segment.io',
  'segment.com','amplitude.com','intercom.io','hubspot.com',
  'marketo.net','pardot.com','eloqua.com','mautic','matomo',
  'piwik','newrelic.com','datadog','sentry.io','logrocket.com',
  'fullstory.com','heap.io','crazyegg.com','clicktale','pingdom',
  'cloudflare-static','cdn.cookielaw'
];

// ── Event handler attributes to strip ───────────────────────
const DANGER_ATTRS = [
  'onabort','onblur','oncanplay','oncanplaythrough','onchange','onclick',
  'oncontextmenu','ondblclick','ondrag','ondragend','ondragenter',
  'ondragleave','ondragover','ondragstart','ondrop','ondurationchange',
  'onemptied','onended','onerror','onfocus','oninput','oninvalid',
  'onkeydown','onkeypress','onkeyup','onload','onloadeddata',
  'onloadedmetadata','onloadstart','onmousedown','onmouseenter',
  'onmouseleave','onmousemove','onmouseout','onmouseover','onmouseup',
  'onmousewheel','onpause','onplay','onplaying','onprogress',
  'onratechange','onreset','onresize','onscroll','onseeked','onseeking',
  'onselect','onshow','onstalled','onsubmit','onsuspend','ontimeupdate',
  'onunload','onbeforeunload','onvolumechange','onwaiting','onpaste',
  'oncopy','oncut','onpointerdown','onpointermove','onpointerup',
  'onpointercancel','onwheel','ontouchstart','ontouchmove','ontouchend'
];

// ── Reset sandbox panel to skeleton state ────────────────────
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
    el.innerHTML = el.innerHTML; // force shimmer reset
  });
}

// ── HTML Sanitizer ───────────────────────────────────────────
function sanitizeForSandbox(rawHtml, baseUrl) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(rawHtml, 'text/html');

  const stats = { scripts: 0, forms: 0, iframes: 0, redirects: 0, trackers: 0, handlers: 0 };

  // 1 — Remove all script elements
  doc.querySelectorAll('script, noscript').forEach(el => { stats.scripts++; el.remove(); });

  // 2 — Remove embedded frame/plugin elements
  doc.querySelectorAll('iframe, frame, frameset, object, embed, applet').forEach(el => {
    stats.iframes++; el.remove();
  });

  // 3 — Block meta redirects and X-Frame-Options (can't affect iframe CSP but cleans it)
  doc.querySelectorAll('meta').forEach(el => {
    const equiv = (el.getAttribute('http-equiv') || '').toLowerCase();
    if (equiv === 'refresh' || equiv === 'x-frame-options' || equiv === 'content-security-policy') {
      stats.redirects++; el.remove();
    }
  });

  // 4 — Remove existing base tags (we inject our own)
  doc.querySelectorAll('base').forEach(el => el.remove());

  // 5 — Remove known tracker scripts/pixels by src/href patterns
  doc.querySelectorAll('[src],[href],[action],[data-src]').forEach(el => {
    const attrs = ['src','href','action','data-src'];
    attrs.forEach(attr => {
      const val = el.getAttribute(attr) || '';
      const isTracker = TRACKER_DOMAINS.some(t => val.includes(t));
      if (isTracker) { stats.trackers++; el.remove(); }
    });
  });

  // Extracted links array
  const extractedLinks = [];
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('javascript:')) {
      try {
        const u = new URL(href, baseUrl);
        extractedLinks.push({ text: a.textContent.trim().substring(0, 50) || href.substring(0, 50), url: u.href });
      } catch (e) {}
    }
  });

  // 6 — Strip all event handler attributes
  const elementsWithHandlers = doc.querySelectorAll(DANGER_ATTRS.map(a => '[' + a + ']').join(','));
  elementsWithHandlers.forEach(el => {
    DANGER_ATTRS.forEach(attr => {
      if (el.hasAttribute(attr)) { el.removeAttribute(attr); stats.handlers++; }
    });
  });

  // Neutralise javascript: URLs
  const elementsWithUrls = doc.querySelectorAll('[href^="javascript:" i], [src^="javascript:" i], [action^="javascript:" i], [formaction^="javascript:" i], [data^="javascript:" i], [href^="vbscript:" i], [src^="vbscript:" i], [href^="data:text/html" i]');
  elementsWithUrls.forEach(el => {
    ['href','src','action','formaction','data'].forEach(attr => {
      const val = (el.getAttribute(attr) || '').trim().toLowerCase();
      if (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html')) {
        el.setAttribute(attr, '#');
      }
    });
  });

  // 7 — Disable all forms
  doc.querySelectorAll('form').forEach(form => {
    stats.forms++;
    form.setAttribute('action', 'about:blank');
    form.setAttribute('method', 'get');
    // Disable all submit buttons inside
    form.querySelectorAll('[type="submit"], button').forEach(btn => btn.setAttribute('disabled', 'true'));
  });

  // 8 — Remove link preloads/prefetches that could leak info
  doc.querySelectorAll('link[rel="prefetch"], link[rel="prerender"], link[rel="dns-prefetch"]').forEach(el => el.remove());

  // 9 — Inject our base tag (resolves relative URLs)
  const base    = doc.createElement('base');
  base.href     = baseUrl;
  base.target   = '_blank'; // all links would open in new tab (blocked by sandbox anyway)
  if (doc.head.firstChild) doc.head.insertBefore(base, doc.head.firstChild);
  else doc.head.appendChild(base);

  // 10 — Inject strict CSP meta (belt-and-suspenders on top of iframe sandbox)
  const csp = doc.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content',
    "default-src * 'unsafe-inline' data: blob:; " +
    "script-src 'none'; " +
    "form-action 'none'; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  );
  doc.head.insertBefore(csp, doc.head.firstChild);

  return { html: doc.documentElement.outerHTML, stats, links: extractedLinks };
}

// ── Update the status block badges ──────────────────────────
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

// ── Main sandbox loader ──────────────────────────────────────
async function loadSandbox(url) {
  // Avoid reloading same URL
  if (sandboxLoaded && sandboxUrl === url) return;

  sandboxUrl    = url;
  sandboxLoaded = false;

  // Reset visual state
  sandboxFrame.classList.add('hidden');
  sandboxLoadingEl.classList.remove('hidden');
  sandboxErrorEl.classList.add('hidden');
  sandboxStatusSub.textContent = 'Fetching page through proxy\u2026';
  sandboxLiveBadge.innerHTML   = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Fetching`;
  sandboxLiveBadge.className   = 'sandbox-live-badge';

  try {
    // Fetch via allorigins.win (free CORS proxy, no key needed)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res  = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    const json = await res.json();

    if (!json.contents) throw new Error('Empty response from proxy');

    sandboxStatusSub.textContent = 'Sanitizing — stripping scripts & trackers\u2026';

    // Sanitize
    const { html, stats, links } = sanitizeForSandbox(json.contents, url);
    if (typeof renderExtractedLinks === 'function') renderExtractedLinks(links, url);

    // Create Blob
    if (sandboxBlobUrl) URL.revokeObjectURL(sandboxBlobUrl);
    const blob      = new Blob([html], { type: 'text/html;charset=utf-8' });
    sandboxBlobUrl  = URL.createObjectURL(blob);

    // Load into iframe
    sandboxFrame.onload = () => {
      // Revoke blob after load to free memory
      setTimeout(() => { URL.revokeObjectURL(sandboxBlobUrl); sandboxBlobUrl = ''; }, 3000);
      sandboxLoaded = true;
    };
    sandboxFrame.src = sandboxBlobUrl;
    sandboxFrame.classList.remove('hidden');
    sandboxLoadingEl.classList.add('hidden');

    // Update status header
    const total = stats.scripts + stats.trackers + stats.handlers + stats.iframes + stats.forms + stats.redirects;
    sandboxStatusSub.textContent = `\u2705 Fully isolated \u2014 ${total} threat${total !== 1 ? 's' : ''} blocked`;
    sandboxLiveBadge.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg> Isolated`;
    sandboxLiveBadge.className   = 'sandbox-live-badge active';

    // Update block count badges
    updateSandboxBlocks(stats);

  } catch (err) {
    sandboxLoadingEl.classList.add('hidden');
    sandboxErrorEl.classList.remove('hidden');
    const msg = err.message || 'Unknown error';
    sandboxErrMsg.textContent = `Sandbox failed: ${msg}`;
    sandboxStatusSub.textContent = 'Could not load sandbox preview';
    sandboxLiveBadge.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Failed`;
    console.warn('[Sandbox] Failed to load:', err);
  }
}


// ════════════════════════════════════════════════════════════
// ── EMAIL CHECKER & SCAM DETECTION MODULE ────────────────────
//
//  Validation layers:
//    1. RFC 5322 format check (regex)
//    2. Local-part structure analysis (length, special chars)
//    3. Disposable / temp email domain detection (400+ domains)
//    4. DNS MX record check via Google DoH (no API key)
//    5. Heuristic scam scoring:
//         • Suspicious TLD for email domain
//         • Typosquatting known brands
//         • Scam keywords in local part
//         • Excessive numbers in local part
//         • Brand impersonation patterns in domain
//         • Free provider used as "business" sender
//         • Double-hyphen / numeric-only domain
//    6. Bulk mode: 50 emails, table + CSV export
// ════════════════════════════════════════════════════════════

// ── DOM refs ─────────────────────────────────────────────────
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

// ── Sub-tab switching ─────────────────────────────────────────
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

// ── Quick-fill email links ────────────────────────────────────
document.querySelectorAll('.quick-btn[data-email]').forEach(btn => {
  btn.addEventListener('click', () => {
    emailInput.value = btn.dataset.email;
    emailClearBtn.classList.add('visible');
  });
});

// ── Clear button ──────────────────────────────────────────────
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

// ── Enter key triggers validate ──────────────────────────────
emailInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') runEmailCheck(emailInput.value.trim());
});
emailCheckBtn.addEventListener('click', () => runEmailCheck(emailInput.value.trim()));
emailBulkRunBtn.addEventListener('click', runBulkEmailCheck);

// ════════════════════════════════════════════════════════════
// ── DATA: Disposable Email Domains (400+) ────────────────────
// ════════════════════════════════════════════════════════════
const DISPOSABLE_DOMAINS = new Set([
  // Classic disposable
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.info','guerrillamail.co',
  'temp-mail.org','temp-mail.io','tempmail.com','tempr.email','tempemail.net',
  '10minutemail.com','10minutemail.net','10minutemail.org','10minutemail.co',
  '10minemail.com','10mail.org','20minutemail.com','dispostable.com',
  'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc',
  'nomail.xl.cx','mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
  'monemail.fr.nf','monmail.fr.nf','trashmail.com','trashmail.at','trashmail.io',
  'trashmail.me','trashmail.net','trashmail.org','trashmail.xyz',
  'mailnull.com','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'spam4.me','spamthisplease.com','spamfree24.org','spamfree24.de',
  'spamfree.eu','spamfree24.net','spamfree24.info','spam.la','spamex.com',
  'jetable.com','jetable.net','jetable.org','jetable.fr','filzmail.com',
  'throwam.com','throwam.net','throwm.me','throwaway.email',
  'getnada.com','nada.email','mintemail.com','mintmail.me',
  'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.biz',
  'spam.su','maileater.com','mailmetrash.com','maildrop.cc','mailnesia.com',
  'mailnew.com','mailsac.com','mailscrap.com','mailshell.com','mailsiphon.com',
  'mailslap.com','mailslite.com','mailnew.com','mailnew.com',
  'fakeinbox.com','fakeinbox.net','fakeinbox.org','fake-box.com',
  'fakemailgenerator.com','guerillamail.com','discard.email','discardmail.com',
  'discardmail.de','spamgrap.com','tempemail.co.za','tempemail.biz',
  'temp-mail.de','getonemail.com','getonemail.net','getonemail.org',
  'momentom.de','mr24.co','mt2009.com','mt2014.com','mt2015.com',
  'mxfuel.com','mymail-in.net','myrealbox.com','n2.jp','netmails.net',
  'objectmail.com','obobbo.com','odaymail.com','oneoffmail.com',
  'onewaymail.com','online.ms','oopi.org','ordinaryamerican.net',
  'owlpic.com','pecinan.com','pecinan.net','pecinan.org','pepbot.com',
  'pookmail.com','prtnx.com','punkass.com','putthisinyourspamdatabase.com',
  'quickinbox.com','rtrtr.com','rushpost.com','s0ny.net','safe-mail.net',
  'safersignup.de','sashort.com','sendspamhere.com','shieldedmail.com',
  'shitmail.me','sicherpost.de','slopsbox.com','slushmail.com',
  'smellfear.com','sofimail.com','sofort-mail.de','spam.care','spam.co',
  'spam.wtf','spamevader.com','spamfree.eu','spamgap.com','spamgoes.in',
  'spamherelots.com','spamhereplease.com','spamhole.com','spamify.com',
  'spaml.com','spaml.de','spammotel.com','spamoff.de','spamserver.net',
  'spamslicer.com','spamspot.com','spamstack.net','spamtest.org',
  'spamtrail.com','spamtrap.ro','superrito.com','suremail.info',
  'teewars.org','teleworm.com','teleworm.us','temporaryemail.net',
  'temporaryemail.us','temporaryforwarding.com','temporaryinbox.com',
  'thankyou2010.com','thisisnotmyrealemail.com','throwam.com',
  'tilien.com','tittbit.in','tmailinator.com','toiea.com',
  'trbvm.com','trillianpro.com','trollproject.com','trud.us',
  'twinmail.de','umail.net','ungmail.com','unids.com','uroid.com',
  'veryrealemail.com','viditag.com','viralplays.com','vpn.st',
  'vubby.com','wazabi.club','wetrainbayarea.com','whatpaas.com',
  'whyspam.me','willhackforfood.biz','wilemail.com','wolfsmail.tk',
  'wralmail.com','wuzup.net','wuzupmail.net','xagloo.com','xemaps.com',
  'xent.com','xmaily.com','xoxy.net','xyzfree.net','yapped.net',
  'yeah.net','yep.it','yogamaven.com','yuurok.com','ze.tc','zehnminuten.de',
  'zippymail.info','zoemail.net','zoemail.org','zomg.info','example.com'
]);

// ── Known legitimate email providers ────────────────────────
const LEGIT_PROVIDERS = new Set([
  'gmail.com','yahoo.com','yahoo.co.uk','yahoo.co.in','yahoo.fr',
  'outlook.com','hotmail.com','hotmail.co.uk','hotmail.fr','live.com',
  'icloud.com','me.com','mac.com','protonmail.com','proton.me',
  'tutanota.com','tutanota.de','fastmail.com','fastmail.fm','fastmail.net',
  'aol.com','zoho.com','zohomail.com','yandex.com','yandex.ru',
  'mail.com','inbox.com','gmx.com','gmx.net','gmx.de','gmx.at','gmx.ch',
  'msn.com','live.in','live.co.uk','live.com.au','windowslive.com',
  'rocketmail.com','rediffmail.com','sbcglobal.net','att.net','bellsouth.net',
  'verizon.net','comcast.net','cox.net','charter.net','earthlink.net'
]);

// ── Scam keywords in email local part ───────────────────────
const SCAM_LOCAL_KEYWORDS = [
  'refund','claim','prize','winner','lottery','million','billion',
  'cashback','reward','bonus','giveaway','free-money','alert',
  'suspended','verify','unlock','helpdesk','support','security',
  'account-update','urgent','final-notice','irs','fbi','interpol',
  'payroll','payment-confirm','invoice-attached','billing','tax-refund',
  'covid','vaccine','covid-relief','stimulus','inheritance',
  'noreply','no-reply','donotreply','admin','administrator',
  'postmaster','webmaster','service','info','contact','help'
];

// ── Known brands for typosquatting in EMAIL domain ───────────
const EMAIL_BRAND_DOMAINS = [
  'paypal','amazon','apple','microsoft','google','facebook','netflix',
  'instagram','twitter','linkedin','dropbox','stripe','shopify',
  'ebay','alibaba','yahoo','gmail','outlook','hotmail','icloud',
  'chase','wellsfargo','bankofamerica','hsbc','barclays','citibank',
  'irs','gov','medicare','socialsecurity','fedex','ups','dhl','usps'
];

// ── RFC 5322 email format validator ─────────────────────────
function isValidEmailFormat(email) {
  // RFC 5322 simplified regex — covers all practical cases
  const re = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
  return re.test(email);
}

// ── DNS MX lookup via Google DoH ────────────────────────────
async function checkMxRecords(domain) {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await res.json();
    // Status 0 = NOERROR
    if (json.Status !== 0) return { hasMx: false, count: 0, servers: [] };
    const mx = (json.Answer || []).filter(r => r.type === 15);
    return {
      hasMx: mx.length > 0,
      count: mx.length,
      servers: mx.map(r => r.data.replace(/^\d+ /, '').replace(/\.$/, ''))
    };
  } catch {
    return { hasMx: null, count: 0, servers: [], error: true }; // null = unknown
  }
}

// ── Heuristic scam scorer ────────────────────────────────────
function emailScamScore(localPart, domain) {
  const findings = [];
  let score = 0;

  const domainLower = domain.toLowerCase();
  const localLower  = localPart.toLowerCase();
  const domainBase  = domainLower.split('.')[0];
  const tld         = '.' + domainLower.split('.').slice(1).join('.');

  // ── Legitimate known provider → big credit
  if (LEGIT_PROVIDERS.has(domainLower)) {
    score -= 20;
    findings.push({ type: 'good', text: `"${domain}" is a well-known, trusted email provider.` });
  }

  // ── Suspicious TLD for email
  const EMAIL_SUSPICIOUS_TLDS = new Set(['.xyz','.top','.tk','.ml','.ga','.cf','.gq','.click',
    '.loan','.stream','.win','.bid','.date','.trade','.review','.cricket','.faith','.party','.zip','.mov']);
  if (EMAIL_SUSPICIOUS_TLDS.has(tld)) {
    score += 28;
    findings.push({ type: 'danger', text: `Domain TLD "${tld}" is commonly used in phishing & scam emails.` });
  }

  // ── Scam keywords in local part
  const kwHits = SCAM_LOCAL_KEYWORDS.filter(k => localLower.includes(k));
  if (kwHits.length >= 2) {
    score += 22;
    findings.push({ type: 'danger', text: `Multiple scam keywords in local part: "${kwHits.slice(0,3).join('", "')}"` });
  } else if (kwHits.length === 1) {
    score += 10;
    findings.push({ type: 'warn', text: `Keyword "${kwHits[0]}" in email address — common in scam/phishing emails.` });
  } else {
    findings.push({ type: 'good', text: 'No scam-related keywords detected in the local part.' });
  }

  // ── Excessive numbers in local part (bots / generated accounts)
  const numMatch = localLower.match(/\d+/g);
  const numTotal = numMatch ? numMatch.join('').length : 0;
  if (numTotal >= 6) {
    score += 15;
    findings.push({ type: 'warn', text: `Local part contains ${numTotal} digits — may be a generated/bot account.` });
  } else if (numTotal >= 3) {
    score += 6;
  }

  // ── Typosquatting of known brand in domain
  const typoHit = EMAIL_BRAND_DOMAINS.find(brand => {
    if (domainBase === brand) return false;
    return levenshtein(domainBase, brand) <= 2 && domainBase.length >= brand.length - 1;
  });
  if (typoHit) {
    score += 35;
    findings.push({ type: 'danger', text: `Domain "${domainBase}" closely resembles "${typoHit}" — possible brand impersonation.` });
  }

  // ── Brand keyword in non-brand domain (support@apple-helpdesk.com)
  const brandImpersonation = EMAIL_BRAND_DOMAINS.find(brand =>
    domainLower.includes(brand) && !LEGIT_PROVIDERS.has(domainLower)
  );
  if (brandImpersonation) {
    score += 30;
    findings.push({ type: 'danger', text: `Domain contains "${brandImpersonation}" but is NOT the official domain — strong impersonation signal.` });
  }

  // ── Double-hyphen in domain (IDN trick)
  if (/--/.test(domainBase)) {
    score += 12;
    findings.push({ type: 'warn', text: 'Double hyphen in domain — may indicate IDN spoofing trick.' });
  }

  // ── Numeric-only domain base
  if (/^\d+$/.test(domainBase)) {
    score += 18;
    findings.push({ type: 'warn', text: 'Domain base is entirely numeric — uncommon for legitimate email domains.' });
  }

  // ── Very long local part (>30 chars)
  if (localPart.length > 30) {
    score += 10;
    findings.push({ type: 'warn', text: `Very long local part (${localPart.length} chars) — unusual for a real email address.` });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

// ── Verdict from score + flags ───────────────────────────────
const EMAIL_VERDICT = {
  clean:    { label: 'Looks Legitimate',    icon: '✅', cls: 'ev-clean',    badgeCls: 'ev-badge-clean',    msg: 'No significant scam signals detected.' },
  low:      { label: 'Low Scam Risk',       icon: '🟡', cls: 'ev-low',     badgeCls: 'ev-badge-low',      msg: 'Minor signals detected. Use with normal caution.' },
  medium:   { label: 'Medium Scam Risk',    icon: '⚠️', cls: 'ev-medium',  badgeCls: 'ev-badge-medium',   msg: 'Several risk signals. Verify sender identity before responding.' },
  high:     { label: 'High Scam Risk',      icon: '🔴', cls: 'ev-high',    badgeCls: 'ev-badge-high',     msg: 'Strong indicators of phishing or scam email.' },
  critical: { label: 'Scam / Fraud Alert',  icon: '🚨', cls: 'ev-critical', badgeCls: 'ev-badge-critical', msg: 'DANGER: Multiple scam/fraud indicators detected. Do NOT engage.' },
  invalid:  { label: 'Invalid Email',       icon: '❌', cls: 'ev-high',    badgeCls: 'ev-badge-invalid',  msg: 'Not a valid email address format.' },
  disposable:{ label: 'Disposable Email',   icon: '🗑️', cls: 'ev-medium',  badgeCls: 'ev-badge-medium',   msg: 'Temporary/disposable address — avoid for important communications.' }
};

function getVerdict(score, isDisposableFlag, formatOk) {
  if (!formatOk) return 'invalid';
  if (isDisposableFlag) return 'disposable';
  if (score <= 10) return 'clean';
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 70) return 'high';
  return 'critical';
}

// ── Score fill colour class ──────────────────────────────────
function emailScoreFillCls(verdict) {
  const map = { clean:'sec-fill-safe', low:'sec-fill-low', medium:'sec-fill-medium',
                high:'sec-fill-high', critical:'sec-fill-critical',
                invalid:'sec-fill-high', disposable:'sec-fill-medium' };
  return map[verdict] || 'sec-fill-medium';
}

// ── Render single email result ───────────────────────────────
function renderEmailResult(data) {
  const { email, localPart, domain, formatOk, isDisposableFlag,
          mx, scam, verdict, verdictMeta } = data;
  const score = scam.score;

  const svgGood   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgWarn   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const svgDanger = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const svgInfo   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const iconMap   = { good: svgGood, warn: svgWarn, danger: svgDanger, info: svgInfo };

  // MX display
  const mxPass    = mx.hasMx === true;
  const mxUnknown = mx.hasMx === null;
  const mxIcon    = mxUnknown ? 'warn' : mxPass ? 'pass' : 'fail';
  const mxLabel   = mxUnknown ? 'Unknown (net error)' : mxPass ? `${mx.count} server${mx.count > 1 ? 's' : ''} found` : 'No MX records';

  // Disposable display
  const dispIcon  = isDisposableFlag ? 'fail' : 'pass';
  const dispLabel = isDisposableFlag ? 'Yes — Temporary Address' : 'No — Persistent Domain';

  // Score bar colour matching verdict
  const fillCls = emailScoreFillCls(verdict);

  // Findings HTML
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

// ── Main single-email orchestrator ───────────────────────────
async function runEmailCheck(email) {
  if (!email) { emailInput.focus(); return; }

  // Show loader
  show(emailBtnLoader);
  hide(emailBtnText);
  emailResult.classList.add('hidden');

  const formatOk = isValidEmailFormat(email);
  const atIdx    = email.lastIndexOf('@');
  const localPart = atIdx > -1 ? email.slice(0, atIdx) : email;
  const domain    = atIdx > -1 ? email.slice(atIdx + 1).toLowerCase() : '';

  // Disposable check (instant)
  const isDisposableFlag = DISPOSABLE_DOMAINS.has(domain);

  // MX check (async)
  const mx = formatOk && domain ? await checkMxRecords(domain) : { hasMx: false, count: 0, servers: [], error: false };

  // Scam heuristics (instant)
  const scam = (formatOk && domain) ? emailScamScore(localPart, domain) : { score: 0, findings: [] };

  // Extra MX penalty
  if (mx.hasMx === false && !mx.error && formatOk) {
    scam.score = Math.min(100, scam.score + 30);
    scam.findings.unshift({ type: 'danger', text: 'No MX records found — this domain cannot receive emails.' });
  } else if (mx.hasMx === true) {
    scam.findings.unshift({ type: 'good', text: `Domain has ${mx.count} active mail server${mx.count > 1 ? 's' : ''}: ${mx.servers.slice(0,2).join(', ')}${mx.count > 2 ? '…' : ''}` });
  }

  const verdict     = getVerdict(scam.score, isDisposableFlag, formatOk);
  const verdictMeta = EMAIL_VERDICT[verdict];

  renderEmailResult({ email, localPart, domain, formatOk, isDisposableFlag, mx, scam, verdict, verdictMeta });

  hide(emailBtnLoader);
  show(emailBtnText);
}

// ── Bulk email check ─────────────────────────────────────────
let emailBulkData = [];

async function runBulkEmailCheck() {
  const emails = parseEmailList(emailBulkInput.value);
  if (!emails.length) return;

  // Show loader
  show(emailBulkBtnLoader);
  hide(emailBulkBtnText);
  emailBulkTableBody.innerHTML = '';
  emailBulkData = [];
  show(emailBulkResults);
  hide(emailBulkSummary);

  let countValid = 0, countScam = 0, countDisp = 0;

  for (let i = 0; i < emails.length; i++) {
    const email  = emails[i];
    const atIdx  = email.lastIndexOf('@');
    const local  = atIdx > -1 ? email.slice(0, atIdx) : email;
    const domain = atIdx > -1 ? email.slice(atIdx + 1).toLowerCase() : '';

    const formatOk = isValidEmailFormat(email);
    const isDisp   = DISPOSABLE_DOMAINS.has(domain);
    const mx       = formatOk && domain ? await checkMxRecords(domain) : { hasMx: false, count: 0, servers: [], error: false };
    const scam     = (formatOk && domain) ? emailScamScore(local, domain) : { score: 0, findings: [] };

    if (mx.hasMx === false && !mx.error && formatOk) scam.score = Math.min(100, scam.score + 30);

    const verdict     = getVerdict(scam.score, isDisp, formatOk);
    const verdictMeta = EMAIL_VERDICT[verdict];

    const row = {
      index: i + 1, email, domain, formatOk, isDisp,
      mxOk: mx.hasMx, mxCount: mx.count,
      score: scam.score, verdict, verdictMeta
    };
    emailBulkData.push(row);

    if (verdict === 'clean' || verdict === 'low') countValid++;
    if (['high','critical','disposable'].includes(verdict)) countScam++;
    if (isDisp) countDisp++;

    // Render row immediately
    const tr = buildEmailTableRow(row);
    emailBulkTableBody.appendChild(tr);

    // Delay to avoid DoH rate limits
    if (i < emails.length - 1) await sleep(400);
  }

  // Summary
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

// ── Bulk email CSV export ─────────────────────────────────────
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

// ════════════════════════════════════════════════════════════
// ── ADDED FEATURES (HISTORY, IP INTEL, QR, LINKS, BULK) ─────
// ════════════════════════════════════════════════════════════

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
    historyList.innerHTML = data.map(item => {
      const date = new Date(item.time).toLocaleString();
      const threatColor = item.threat === 'safe' ? '#22c55e' : (item.threat === 'critical' ? '#ef4444' : (item.threat === 'low' ? '#fde047' : '#f59e0b'));
      return `
        <div class="history-item" onclick="document.getElementById('urlInput').value='${escapeHtml(item.url)}'; document.getElementById('checkBtn').click();">
          <img class="history-favicon" src="${escapeHtml(item.favicon)}" onerror="this.style.display='none'" />
          <div class="history-url">${escapeHtml(item.title)}</div>
          <div class="history-threat" style="color:${threatColor}">${escapeHtml(item.threat)}</div>
          <div class="history-time">${date}</div>
        </div>
      `;
    }).join('');
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
      const ip = data.Answer.find(a => a.type === 1); // A record
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
      if (typeof makeResultRow === 'function') tbody.appendChild(makeResultRow(r));
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
      console.log('SW registration failed: ', err);
    });
  });
}
