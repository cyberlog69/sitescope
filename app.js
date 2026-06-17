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
  // Switch to screenshot tab
  activateTab('screenshot');
}

// ── Tab Switching ───────────────────────────────────────────
function activateTab(tab) {
  if (tab === 'screenshot') {
    tabScreenshot.classList.add('active');
    tabLive.classList.remove('active');
    show(screenshotView);
    hide(liveView);
  } else {
    tabLive.classList.add('active');
    tabScreenshot.classList.remove('active');
    hide(screenshotView);
    show(liveView);
    // Load iframe lazily
    if (currentUrl && siteFrame.src !== currentUrl) {
      siteFrame.src = currentUrl;
      iframeAddress.textContent = currentUrl;
    }
  }
}

tabScreenshot.addEventListener('click', () => activateTab('screenshot'));
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
      handleFetchError('Site returned an error or could not be reached.');
    }

  } catch (err) {
    setLoading(false);
    renderCategory(url, domain, '');
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
