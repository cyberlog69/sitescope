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
      scanSecurity(url);

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
    id: 'government', label: 'Government', emoji: '\uD83C\uDFDB\uFE0F', cssClass: 'cat-government',
    description: 'An official government or public-sector website.',
    tlds: ['.gov','.gov.uk','.gov.in','.gov.au','.gc.ca','.gob.mx','.gouv.fr',
           '.gov.za','.gov.sg','.govt.nz','.gov.ng','.gov.pk'],
    domains: ['whitehouse.gov','irs.gov','usa.gov','europa.eu','un.org',
              'nato.int','data.gov','congress.gov','senate.gov','who.int'],
    subdomainKw: ['gov','govt','government','federal','state','municipal','city','county'],
    keywords: [
      {w:'federal government',s:22},{w:'official government',s:22},{w:'government portal',s:24},
      {w:'ministry',s:14},{w:'parliament',s:16},{w:'senate',s:14},{w:'congress',s:14},
      {w:'legislation',s:14},{w:'public service',s:16},{w:'civil service',s:14},
      {w:'state agency',s:18},{w:'national authority',s:20},{w:'municipal',s:10},
      {w:'government',s:12},{w:'official',s:8},{w:'prefecture',s:14},{w:'governor',s:12}
    ],
    negativeKw: ['shop','buy','cart','game','movie','social media','tweet','recipe'],
    minScore: 0, requireDomain: false
  },

  // ── 2. Military / Defense ──────────────────────────────────
  {
    id: 'military', label: 'Military / Defense', emoji: '\uD83C\uDF96\uFE0F', cssClass: 'cat-military',
    description: 'A military, defense, or armed-forces organization.',
    tlds: ['.mil'],
    domains: ['nato.int','army.mil','navy.mil','af.mil','marines.mil','defense.gov','dod.gov'],
    subdomainKw: ['mil','army','navy','airforce','defense','military'],
    keywords: [
      {w:'armed forces',s:22},{w:'defense department',s:22},{w:'military base',s:22},
      {w:'military',s:18},{w:'pentagon',s:18},{w:'veteran',s:14},{w:'troops',s:14},
      {w:'soldier',s:12},{w:'marine corps',s:18},{w:'naval',s:14},{w:'brigade',s:12}
    ],
    negativeKw: ['shop','game','social','news','recipe','movie'],
    minScore: 0, requireDomain: false
  },

  // ── 3. Education ──────────────────────────────────────────
  {
    id: 'education', label: 'Education', emoji: '\uD83C\uDF93', cssClass: 'cat-education',
    description: 'A school, university, or educational platform.',
    tlds: ['.edu','.ac.uk','.ac.in','.edu.au','.sch.uk','.edu.pk','.edu.sg'],
    domains: ['coursera.org','udemy.com','khanacademy.org','edx.org','duolingo.com',
              'chegg.com','quizlet.com','skillshare.com','pluralsight.com',
              'mit.edu','harvard.edu','stanford.edu','oxford.ac.uk','cambridge.org',
              'codecademy.com','brilliant.org','futurelearn.com'],
    subdomainKw: ['learn','lms','elearning','campus','student','academic','courses','school','edu'],
    keywords: [
      {w:'online learning platform',s:26},{w:'student portal',s:24},{w:'learning management system',s:28},
      {w:'university',s:16},{w:'college',s:14},{w:'e-learning',s:18},
      {w:'online course',s:20},{w:'lecture',s:12},{w:'faculty',s:14},
      {w:'curriculum',s:14},{w:'degree program',s:18},{w:'diploma',s:12},
      {w:'tutorial',s:10},{w:'classroom',s:12},{w:'professor',s:14},
      {w:'scholarship',s:14},{w:'campus',s:10},{w:'education',s:12},{w:'school',s:8}
    ],
    negativeKw: ['shop','buy','cart','social media','game','news','hospital'],
    minScore: 0, requireDomain: false
  },

  // ── 4. Healthcare & Medical ────────────────────────────────
  {
    id: 'healthcare', label: 'Healthcare & Medical', emoji: '\uD83C\uDFE5', cssClass: 'cat-healthcare',
    description: 'A medical, health, insurance, or healthcare provider resource.',
    tlds: [],
    domains: [
      // Reference/info
      'webmd.com','healthline.com','mayoclinic.org','nih.gov','cdc.gov',
      'medscape.com','drugs.com','rxlist.com','medlineplus.gov','who.int',
      'clevelandclinic.org','hopkinsmedicine.org',
      // Insurance / payer
      'aetna.com','cigna.com','uhc.com','bcbs.com','humana.com','anthem.com',
      'centene.com','molina.com','oscar.com','ambetter.com',
      // Provider data / credentialing
      'caqh.org','availity.com','athenahealth.com','epic.com',
      'eclinicalworks.com','nextgen.com','kareo.com','practicefusion.com',
      'changehealthcare.com','emdeon.com','trizetto.com','optum.com',
      'zelis.com','navicure.com','waystar.com'
    ],
    // Key: these subdomain tokens are VERY strong for provider portals
    subdomainKw: [
      'health','medical','med','clinical','care','provider','patient',
      'hospital','pharmacy','wellness','caqh','proview','credentialing',
      'payer','claims','ehr','emr','insurance','nonprod','sit','uat',
      'prod','healthplan','rx','clinic'
    ],
    keywords: [
      // ── Very strong multi-word phrases (high specificity)
      {w:'provider credentialing',s:32},{w:'credentialing portal',s:32},
      {w:'provider portal',s:30},{w:'patient portal',s:30},{w:'member portal',s:28},
      {w:'health insurance',s:26},{w:'insurance coverage',s:26},{w:'payer network',s:28},
      {w:'network provider',s:26},{w:'insurance company',s:24},
      {w:'prior authorization',s:28},{w:'claims processing',s:28},
      {w:'electronic health record',s:28},{w:'healthcare network',s:26},
      {w:'benefits portal',s:26},{w:'care management',s:24},
      {w:'healthcare provider',s:24},{w:'medical records',s:24},
      {w:'health plan',s:22},{w:'telehealth',s:22},
      {w:'clinical data',s:22},{w:'formulary',s:22},
      // ── Strong single-domain terms
      {w:'physician',s:18},{w:'pharmacist',s:18},{w:'credentialing',s:22},
      {w:'diagnosis',s:16},{w:'prescription',s:16},{w:'therapy',s:12},
      {w:'vaccination',s:16},{w:'pharmaceutical',s:18},{w:'pediatric',s:16},
      {w:'surgery',s:14},{w:'radiology',s:18},{w:'oncology',s:18},
      {w:'pathology',s:18},{w:'cardiology',s:18},{w:'orthopedic',s:18},
      // ── Generic but contributing
      {w:'healthcare',s:14},{w:'medical',s:10},{w:'hospital',s:12},
      {w:'clinic',s:12},{w:'health',s:8},{w:'patient',s:8},
      {w:'provider',s:10},{w:'doctor',s:10},{w:'nurse',s:10},
      {w:'insurance',s:8},{w:'wellness',s:8},{w:'treatment',s:8},
      {w:'payer',s:16},{w:'claims',s:12}
    ],
    negativeKw: ['game','video game','shop','cart','social network','tweet','movie','music','recipe'],
    minScore: 0, requireDomain: false
  },

  // ── 5. Business / Enterprise Portal ───────────────────────
  {
    id: 'portal', label: 'Business / Enterprise Portal', emoji: '\uD83C\uDFE2', cssClass: 'cat-portal',
    description: 'A business application, enterprise portal, internal tool, or SaaS platform.',
    tlds: [],
    domains: [
      'salesforce.com','workday.com','sap.com','oracle.com','servicenow.com',
      'zendesk.com','atlassian.com','freshdesk.com','hubspot.com','pipedrive.com',
      'monday.com','asana.com','notion.so','airtable.com','smartsheet.com',
      'slack.com','zoom.us','webex.com','sharepoint.com','sharepoint.microsoft.com',
      'portal.azure.com'
    ],
    subdomainKw: [
      'portal','app','dashboard','admin','manage','platform','console','workspace',
      'enterprise','internal','nonprod','sit','uat','qa','staging','crm','erp',
      'hrms','intranet','employee','vendor','client','partner','b2b'
    ],
    keywords: [
      // ── Very strong portal signals
      {w:'enterprise portal',s:30},{w:'employee portal',s:30},{w:'client portal',s:30},
      {w:'vendor portal',s:30},{w:'partner portal',s:30},{w:'supplier portal',s:28},
      {w:'self-service portal',s:28},{w:'customer portal',s:28},
      {w:'single sign-on',s:24},{w:'admin panel',s:22},{w:'management console',s:24},
      {w:'workflow automation',s:22},{w:'ticketing system',s:20},{w:'help desk',s:18},
      {w:'project management',s:18},{w:'task management',s:18},
      {w:'human resources',s:18},{w:'payroll system',s:20},
      {w:'accounting software',s:20},{w:'knowledge base',s:16},
      // ── Moderate
      {w:'dashboard',s:14},{w:'sso',s:14},{w:'crm',s:14},{w:'erp',s:14},
      {w:'workflow',s:12},{w:'saas',s:14},{w:'b2b',s:14},{w:'automation',s:10}
    ],
    negativeKw: ['buy now','add to cart','recipe','game','movie','music','tweet','follower','news'],
    minScore: 0, requireDomain: false
  },

  // ── 6. Finance & Banking ───────────────────────────────────
  {
    id: 'finance', label: 'Finance & Banking', emoji: '\uD83D\uDCB0', cssClass: 'cat-finance',
    description: 'A finance, banking, investment, or fintech platform.',
    tlds: [],
    domains: [
      'bloomberg.com','forbes.com','wsj.com','investopedia.com','nasdaq.com',
      'nyse.com','bankofamerica.com','chase.com','paypal.com','stripe.com',
      'coinbase.com','binance.com','fidelity.com','schwab.com','robinhood.com',
      'nerdwallet.com','creditkarma.com','mint.com','wise.com','revolut.com',
      'quickbooks.com','xero.com','freshbooks.com'
    ],
    subdomainKw: ['bank','finance','invest','trading','crypto','payments','billing','accounting'],
    keywords: [
      {w:'investment portfolio',s:22},{w:'stock market',s:22},{w:'cryptocurrency exchange',s:24},
      {w:'wealth management',s:22},{w:'financial planning',s:22},{w:'interest rate',s:20},
      {w:'banking',s:14},{w:'investment',s:14},{w:'trading platform',s:20},
      {w:'forex',s:16},{w:'bonds',s:14},{w:'equity',s:14},{w:'fintech',s:18},
      {w:'bookkeeping',s:14},{w:'tax filing',s:18},{w:'mortgage',s:14},
      {w:'credit score',s:18},{w:'payment gateway',s:18},{w:'digital wallet',s:18},
      {w:'finance',s:8},{w:'accounting',s:10},{w:'budget',s:8},{w:'loan',s:10}
    ],
    negativeKw: ['game','social media','movie','recipe','travel','hospital','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 7. E-Commerce / Shopping ──────────────────────────────
  {
    id: 'ecommerce', label: 'E-Commerce / Shopping', emoji: '\uD83D\uDED2', cssClass: 'cat-ecommerce',
    description: 'An online retail store or shopping marketplace.',
    tlds: [],
    domains: [
      'amazon.com','ebay.com','walmart.com','shopify.com','etsy.com','alibaba.com',
      'aliexpress.com','target.com','bestbuy.com','newegg.com','wayfair.com',
      'zappos.com','overstock.com','wish.com','flipkart.com','myntra.com'
    ],
    subdomainKw: ['shop','store','cart','checkout','order'],
    keywords: [
      {w:'add to cart',s:32},{w:'free shipping',s:28},{w:'buy now',s:28},
      {w:'shopping cart',s:28},{w:'online store',s:24},{w:'return policy',s:22},
      {w:'product catalog',s:22},{w:'checkout',s:20},{w:'discount code',s:22},
      {w:'coupon',s:18},{w:'promo code',s:20},{w:'retail',s:14},{w:'marketplace',s:16},
      {w:'delivery',s:10},{w:'shipping',s:14},{w:'wishlist',s:18},
      {w:'shop',s:8},{w:'store',s:8},{w:'buy',s:8},{w:'price',s:6},{w:'sale',s:8}
    ],
    negativeKw: ['hospital','government','military','university','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 8. Social Media ───────────────────────────────────────
  // requireDomain = true: keyword-only hits can't win alone.
  // This prevents misclassification of portals as "social".
  {
    id: 'social', label: 'Social Media', emoji: '\uD83D\uDCF1', cssClass: 'cat-social',
    description: 'A social networking or community platform.',
    tlds: [],
    requireDomain: true,   // ← MUST have a domain/subdomain/TLD match
    domains: [
      'facebook.com','twitter.com','x.com','instagram.com','tiktok.com',
      'linkedin.com','snapchat.com','pinterest.com','reddit.com','tumblr.com',
      'discord.com','telegram.org','whatsapp.com','mastodon.social',
      'threads.net','bsky.app','weibo.com','vk.com','minds.com'
    ],
    subdomainKw: ['social','community','forum'],
    keywords: [
      // Only VERY specific social phrases score high
      {w:'social networking platform',s:32},{w:'social media platform',s:32},
      {w:'social network',s:28},{w:'friend request',s:28},{w:'news feed',s:26},
      {w:'direct message',s:22},{w:'retweet',s:24},{w:'hashtag trending',s:22},
      {w:'short video platform',s:24},{w:'influencer marketing',s:22},
      {w:'followers count',s:22},{w:'user timeline',s:22},
      // Generic social words — very low weight, can't win alone
      {w:'tweet',s:12},{w:'reels',s:12},{w:'stories',s:8},{w:'followers',s:8},
      {w:'hashtag',s:10},{w:'influencer',s:10},
      // These are far too generic — minimal weight
      {w:'community',s:4},{w:'profile',s:2},{w:'share',s:2},{w:'post',s:2}
    ],
    negativeKw: [
      'hospital','provider','insurance','government','military',
      'shop','university','credentialing','claims','payer','dashboard'
    ],
    minScore: 30   // requires at least 30 pts — means a domain match is nearly mandatory
  },

  // ── 9. Technology & Software ──────────────────────────────
  {
    id: 'technology', label: 'Technology & Software', emoji: '\uD83D\uDCBB', cssClass: 'cat-technology',
    description: 'A technology company, developer tool, or software product.',
    tlds: [],
    domains: [
      'github.com','gitlab.com','stackoverflow.com','developer.mozilla.org',
      'npmjs.com','apple.com','google.com','microsoft.com','linux.org',
      'docker.com','vercel.com','netlify.com','cloudflare.com',
      'digitalocean.com','heroku.com','jetbrains.com','replit.com',
      'codesandbox.io','openai.com','anthropic.com','huggingface.co'
    ],
    subdomainKw: ['dev','api','docs','developer','code','git','tech','sdk','cloud','repo'],
    keywords: [
      {w:'open source software',s:22},{w:'software development',s:22},{w:'developer tools',s:22},
      {w:'machine learning model',s:22},{w:'artificial intelligence',s:20},
      {w:'api documentation',s:24},{w:'cloud computing',s:20},{w:'devops pipeline',s:22},
      {w:'continuous integration',s:22},{w:'microservices',s:20},{w:'kubernetes',s:20},
      {w:'data science',s:18},{w:'open-source',s:18},{w:'programming language',s:18},
      {w:'cybersecurity',s:18},{w:'infrastructure as code',s:22},
      {w:'software',s:8},{w:'developer',s:10},{w:'programming',s:14},{w:'framework',s:12},
      {w:'technology',s:8},{w:'tech',s:6},{w:'cloud',s:8},{w:'startup',s:8}
    ],
    negativeKw: ['hospital','recipe','game','movie','shop','social network','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 10. News & Media ──────────────────────────────────────
  {
    id: 'news', label: 'News & Media', emoji: '\uD83D\uDCF0', cssClass: 'cat-news',
    description: 'A news outlet, journalism, or media publication.',
    tlds: [],
    domains: [
      'cnn.com','bbc.com','bbc.co.uk','nytimes.com','theguardian.com',
      'reuters.com','apnews.com','washingtonpost.com','foxnews.com',
      'nbcnews.com','aljazeera.com','theatlantic.com','time.com',
      'economist.com','newsweek.com','vox.com','theverge.com','wired.com',
      'huffpost.com','buzzfeed.com','ndtv.com','thehindu.com'
    ],
    subdomainKw: ['news','press','media','editorial','breaking','headline'],
    keywords: [
      {w:'breaking news',s:28},{w:'latest news',s:24},{w:'world news',s:24},
      {w:'investigative journalism',s:30},{w:'editorial board',s:24},
      {w:'press release',s:22},{w:'news headline',s:24},{w:'live coverage',s:22},
      {w:'journalist',s:18},{w:'reporter',s:16},{w:'broadcast',s:14},
      {w:'publication',s:14},{w:'newsletter',s:14},{w:'editorial',s:14},
      {w:'news',s:8},{w:'media',s:8},{w:'press',s:8},{w:'magazine',s:12}
    ],
    negativeKw: ['shop','game','recipe','social network','hospital','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 11. Gaming ────────────────────────────────────────────
  {
    id: 'gaming', label: 'Gaming', emoji: '\uD83C\uDFAE', cssClass: 'cat-gaming',
    description: 'A gaming platform, publisher, or gaming community.',
    tlds: [],
    domains: [
      'steampowered.com','epicgames.com','ign.com','gamespot.com','kotaku.com',
      'twitch.tv','ea.com','ubisoft.com','blizzard.com','riotgames.com',
      'xbox.com','playstation.com','nintendo.com','roblox.com','minecraft.net',
      'gog.com','humblebundle.com'
    ],
    subdomainKw: ['game','games','gaming','play','esports','arcade'],
    keywords: [
      {w:'battle royale',s:28},{w:'video game',s:24},{w:'online multiplayer',s:24},
      {w:'esports tournament',s:26},{w:'pc gaming',s:22},{w:'gaming platform',s:24},
      {w:'game developer',s:22},{w:'open world game',s:24},
      {w:'fps',s:14},{w:'rpg',s:14},{w:'mmorpg',s:20},{w:'leaderboard',s:18},
      {w:'gameplay',s:18},{w:'streamer',s:14},{w:'indie game',s:20},
      {w:'game',s:8},{w:'gaming',s:10},{w:'player',s:6},{w:'level',s:4}
    ],
    negativeKw: ['hospital','insurance','government','recipe','news','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 12. Entertainment & Streaming ─────────────────────────
  {
    id: 'entertainment', label: 'Entertainment & Streaming', emoji: '\uD83C\uDFAC', cssClass: 'cat-entertainment',
    description: 'A streaming, movies, music, or media content platform.',
    tlds: [],
    domains: [
      'netflix.com','youtube.com','spotify.com','disneyplus.com','hulu.com',
      'hbomax.com','max.com','primevideo.com','peacocktv.com','soundcloud.com',
      'pandora.com','tidal.com','imdb.com','rottentomatoes.com','crunchyroll.com',
      'deezer.com'
    ],
    subdomainKw: ['stream','watch','movies','shows','music','podcast'],
    keywords: [
      {w:'streaming platform',s:28},{w:'watch online',s:24},{w:'binge watch',s:24},
      {w:'original series',s:22},{w:'movie trailer',s:24},{w:'tv show',s:22},
      {w:'music streaming',s:24},{w:'podcast episode',s:22},
      {w:'movie',s:10},{w:'film',s:10},{w:'series',s:10},{w:'episode',s:10},
      {w:'streaming',s:14},{w:'music',s:8},{w:'playlist',s:12},{w:'album',s:12}
    ],
    negativeKw: ['shop','hospital','government','recipe','social network','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 13. Reference & Encyclopedia ──────────────────────────
  {
    id: 'reference', label: 'Reference & Encyclopedia', emoji: '\uD83D\uDCDA', cssClass: 'cat-reference',
    description: 'A reference site, encyclopedia, or knowledge base.',
    tlds: [],
    domains: [
      'wikipedia.org','wikimedia.org','britannica.com','merriam-webster.com',
      'dictionary.com','thesaurus.com','wolframalpha.com','archive.org',
      'jstor.org','pubmed.ncbi.nlm.nih.gov','scholar.google.com'
    ],
    subdomainKw: ['wiki','encyclopedia','docs','kb','knowledgebase','reference','lib'],
    keywords: [
      {w:'free encyclopedia',s:28},{w:'open encyclopedia',s:28},{w:'knowledge base',s:22},
      {w:'dictionary definition',s:24},{w:'scholarly article',s:24},{w:'peer reviewed',s:24},
      {w:'encyclopedia',s:22},{w:'thesaurus',s:20},{w:'reference guide',s:20},
      {w:'wiki',s:16},{w:'definition',s:14},{w:'glossary',s:18},
      {w:'archive',s:12},{w:'library',s:10},{w:'research',s:8}
    ],
    negativeKw: ['shop','game','movie','social media','recipe'],
    minScore: 0, requireDomain: false
  },

  // ── 14. Design & Creative ─────────────────────────────────
  {
    id: 'design', label: 'Design & Creative', emoji: '\uD83C\uDFA8', cssClass: 'cat-design',
    description: 'A design tool, creative platform, or digital portfolio site.',
    tlds: [],
    domains: [
      'dribbble.com','behance.net','figma.com','adobe.com','canva.com',
      'unsplash.com','pexels.com','shutterstock.com','gettyimages.com',
      'invision.com','framer.com','webflow.com','sketch.com'
    ],
    subdomainKw: ['design','creative','studio','portfolio'],
    keywords: [
      {w:'ui design',s:24},{w:'ux design',s:24},{w:'graphic design',s:24},
      {w:'design system',s:22},{w:'color palette',s:22},{w:'design tool',s:22},
      {w:'wireframe',s:20},{w:'prototype',s:18},{w:'mockup',s:18},
      {w:'illustration',s:18},{w:'typography',s:20},{w:'branding',s:16},
      {w:'design',s:8},{w:'creative',s:8},{w:'portfolio',s:12},
      {w:'photography',s:12},{w:'icon',s:8}
    ],
    negativeKw: ['hospital','government','game','shop','news','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 15. Travel & Tourism ──────────────────────────────────
  {
    id: 'travel', label: 'Travel & Tourism', emoji: '\u2708\uFE0F', cssClass: 'cat-travel',
    description: 'A travel booking, tourism, or destination guide.',
    tlds: [],
    domains: [
      'booking.com','expedia.com','airbnb.com','tripadvisor.com','kayak.com',
      'hotels.com','skyscanner.com','agoda.com','lonelyplanet.com','viator.com'
    ],
    subdomainKw: ['travel','tours','booking','flights','hotels','vacation'],
    keywords: [
      {w:'book flights',s:28},{w:'hotel booking',s:26},{w:'vacation package',s:24},
      {w:'travel guide',s:24},{w:'travel deals',s:22},{w:'flight search',s:24},
      {w:'destination guide',s:24},{w:'tour package',s:22},{w:'travel insurance',s:22},
      {w:'travel',s:10},{w:'tourism',s:14},{w:'hotel',s:10},{w:'flight',s:10},
      {w:'vacation',s:12},{w:'itinerary',s:14},{w:'sightseeing',s:14}
    ],
    negativeKw: ['hospital','government','game','recipe','credentialing'],
    minScore: 0, requireDomain: false
  },

  // ── 16. Food & Lifestyle ──────────────────────────────────
  {
    id: 'food', label: 'Food & Lifestyle', emoji: '\uD83C\uDF55', cssClass: 'cat-food',
    description: 'A food, recipe, restaurant, or lifestyle website.',
    tlds: [],
    domains: [
      'allrecipes.com','foodnetwork.com','epicurious.com','seriouseats.com',
      'tasty.co','delish.com','doordash.com','ubereats.com','grubhub.com',
      'yelp.com','zomato.com','opentable.com','bonappetit.com'
    ],
    subdomainKw: ['food','recipe','menu','restaurant','kitchen','chef'],
    keywords: [
      {w:'cooking tips',s:22},{w:'restaurant review',s:22},{w:'food delivery',s:22},
      {w:'meal prep',s:20},{w:'healthy eating',s:18},{w:'vegan recipe',s:22},
      {w:'food blog',s:20},{w:'nutrition facts',s:18},
      {w:'recipe',s:18},{w:'chef',s:12},{w:'ingredient',s:14},{w:'cuisine',s:14},
      {w:'food',s:8},{w:'cooking',s:10},{w:'restaurant',s:10},{w:'meal',s:8}
    ],
    negativeKw: ['hospital','government','game','social media','credentialing'],
    minScore: 0, requireDomain: false
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
        <a class="row-action-btn" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open
        </a>
        <button class="row-action-btn inspect-btn" onclick="inspectFromBulk('${escapeHtml(r.url)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Inspect
        </button>
      </div>
    </td>
  `;
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

  // 6 — Strip all event handler attributes
  doc.querySelectorAll('*').forEach(el => {
    DANGER_ATTRS.forEach(attr => {
      if (el.hasAttribute(attr)) { el.removeAttribute(attr); stats.handlers++; }
    });

    // Neutralise javascript: URLs
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
    form.setAttribute('action', 'javascript:void(0)');
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

  return { html: doc.documentElement.outerHTML, stats };
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
    const { html, stats } = sanitizeForSandbox(json.contents, url);

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
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `email-check-${Date.now()}.csv`;
  a.click();
});
