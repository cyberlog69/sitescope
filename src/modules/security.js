// security.js — Heuristic & URLhaus Threat Scanner module

// display metadata
export const THREAT_META = {
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

const SUSPICIOUS_TLDS = new Set([
  '.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.loan','.work',
  '.download','.stream','.racing','.win','.bid','.date','.review','.trade',
  '.webcam','.accountant','.science','.cricket','.faith','.party'
]);

const KNOWN_BRANDS = [
  'google','facebook','twitter','instagram','amazon','microsoft','apple',
  'paypal','netflix','spotify','linkedin','github','youtube','whatsapp',
  'telegram','discord','dropbox','adobe','salesforce','stripe',
  'coinbase','binance','metamask','outlook','office365','yahoo','steam'
];

const PHISHING_KEYWORDS = [
  'login','signin','sign-in','logon','verify','verification','validate',
  'update','account','secure','security','confirm','banking','bank',
  'password','credential','wallet','recovery','support','helpdesk',
  'suspended','alert','notice','locked','unlock','claim','reward',
  'prize','winner','free','gift','offer','cashback','refund',
  '2fa','mfa','otp','code','signin-secure','unusual-activity','tax-refund',
  'post-office','shipping-update','invoice','payment','billing'
];

const SUSPICIOUS_EXTS = ['.exe','.bat','.cmd','.msi','.vbs','.ps1','.jar','.apk','.dmg','.iso'];

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

// Shannon entropy calculation to detect random DGA domain names
function calculateEntropy(str) {
  const len = str.length;
  if (len === 0) return 0;
  const freqs = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freqs[char] = (freqs[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freqs) {
    const p = freqs[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Helper to check for private / Link-local IP ranges (SSRF prevention)
export function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [p0, p1, p2, p3] = parts;
  if (p0 === 127) return true; // Loopback
  if (p0 === 10) return true;  // Private Space
  if (p0 === 172 && (p1 >= 16 && p1 <= 31)) return true; // Private Space
  if (p0 === 192 && p1 === 168) return true; // Private Space
  if (p0 === 169 && p1 === 254) return true; // Link-Local
  if (p0 === 0) return true;   // Any IP
  return false;
}

export function heuristicScan(url) {
  const findings = [];
  let score = 0;

  let parsedUrl;
  try { parsedUrl = new URL(url); }
  catch { return { level: 'high', score: 60, findings: [{ type: 'danger', text: 'Malformed or unparseable URL.' }], dbStatus: 'unknown' }; }

  const scheme   = parsedUrl.protocol;
  const hostname = parsedUrl.hostname.toLowerCase();
  const fullUrl  = url.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  // HTTPS check
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

  // IP address in URL
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    score += 30;
    findings.push({ type: 'danger', text: 'URL uses a raw IP address instead of a domain name — common in malware/phishing.' });
    if (isPrivateIP(hostname)) {
      score += 40;
      findings.push({ type: 'danger', text: 'URL references a private/local IP space — potential local network SSRF attempt.' });
    }
  }

  // Port in URL
  if (parsedUrl.port && !['80','443'].includes(parsedUrl.port)) {
    score += 20;
    findings.push({ type: 'warn', text: `Non-standard port ${parsedUrl.port} detected — uncommon for legitimate sites.` });
  }

  // Suspicious TLD
  const tldMatch = hostname.match(/(\.[^.]+)$/);
  if (tldMatch && SUSPICIOUS_TLDS.has(tldMatch[1])) {
    score += 25;
    findings.push({ type: 'warn', text: `Suspicious TLD "${tldMatch[1]}" — frequently used in phishing campaigns.` });
  }

  // Non-ASCII / homograph attack
  if (/[^\x00-\x7F]/.test(hostname) || hostname.includes('xn--')) {
    score += 35;
    findings.push({ type: 'danger', text: 'Non-ASCII or Punycode characters in domain — possible homograph/spoofing attack.' });
  }

  // @ symbol trick
  if (url.includes('@') && url.indexOf('@') < url.indexOf(hostname)) {
    score += 30;
    findings.push({ type: 'danger', text: '@ symbol before domain — used to hide the real destination in phishing links.' });
  }

  // Excessive URL length
  if (url.length > 120) {
    score += 12;
    findings.push({ type: 'warn', text: `Very long URL (${url.length} chars) — long URLs are often used to obfuscate malicious paths.` });
  }

  // Too many subdomains (dots)
  const dotCount = (hostname.match(/\./g) || []).length;
  if (dotCount >= 3) {
    score += 15;
    findings.push({ type: 'warn', text: `${dotCount + 1} domain segments detected — excessive subdomains are common in phishing.` });
  }

  // Phishing keywords in URL
  const hitKws = PHISHING_KEYWORDS.filter(k => fullUrl.includes(k));
  if (hitKws.length >= 2) {
    score += 20;
    findings.push({ type: 'warn', text: `Phishing-related keywords in URL: "${hitKws.slice(0,3).join('", "')}" — common in credential-harvest pages.` });
  } else if (hitKws.length === 1) {
    score += 8;
    findings.push({ type: 'info', text: `Keyword "${hitKws[0]}" in URL — alone not a threat, but note if combined with other signals.` });
  }

  // Double hyphen domain
  if (/--/.test(hostname.split('.')[0])) {
    score += 10;
    findings.push({ type: 'warn', text: 'Double hyphen in domain label — may indicate an IDN trick or Punycode attempt.' });
  }

  // Suspicious executable extensions in path
  const extMatch = SUSPICIOUS_EXTS.find(e => pathname.endsWith(e));
  if (extMatch) {
    score += 15;
    findings.push({ type: 'danger', text: `URL path ends in "${extMatch}" — direct download of an executable file.` });
  }

  // Domain structure checks
  const hostnameParts = hostname.replace(/^www\./, '').split('.');
  if (hostnameParts.length >= 2) {
    const domainBase = hostnameParts[hostnameParts.length - 2];
    
    // Multiple hyphens in base domain (e.g. paypal-login-verification)
    const hyphenCount = (domainBase.match(/-/g) || []).length;
    if (hyphenCount >= 2) {
      score += 15;
      findings.push({ type: 'warn', text: `Multiple hyphens (${hyphenCount}) in domain base "${domainBase}" — frequently used to construct fake subdomains.` });
    }

    // Levenshtein Typosquatting
    const typoHit = KNOWN_BRANDS.find(brand => {
      if (domainBase === brand) return false;
      return levenshtein(domainBase, brand) <= 2 && domainBase.length >= brand.length - 1;
    });
    if (typoHit) {
      score += 25;
      findings.push({ type: 'danger', text: `Domain "${domainBase}" closely resembles "${typoHit}" — possible brand impersonation / typosquatting.` });
    }

    // Subdomain brand spoofing check
    // If a known brand is present in subdomains but the main domain is different (e.g., brand.com.login-verify.xyz)
    const subdomains = hostnameParts.slice(0, hostnameParts.length - 2);
    if (subdomains.length > 0) {
      const spoofedBrand = KNOWN_BRANDS.find(brand => subdomains.includes(brand));
      if (spoofedBrand && domainBase !== spoofedBrand) {
        score += 30;
        findings.push({ type: 'danger', text: `Brand name "${spoofedBrand}" used as subdomain of a different base domain "${domainBase}" — suspicious obfuscation.` });
      }
    }

    // Shannon Entropy Check for random generated domains (DGA)
    const entropy = calculateEntropy(domainBase);
    if (entropy > 3.85 && domainBase.length > 8) {
      score += 20;
      findings.push({ type: 'warn', text: `High randomness (entropy: ${entropy.toFixed(2)}) in base domain "${domainBase}" — common in Domain Generation Algorithms (DGA) used by malware.` });
    }

    // Known brand exact match
    const isKnownBrand = KNOWN_BRANDS.includes(domainBase);
    if (isKnownBrand && !spoofedBrand) {
      score -= 15;
      findings.push({ type: 'good', text: `Domain matches known brand "${domainBase}" — appears to be the genuine site.` });
    }
  }

  score = Math.max(0, Math.min(100, score));

  const hasDanger = findings.some(f => f.type === 'danger' || f.type === 'warn');
  if (!hasDanger) {
    findings.push({ type: 'good', text: 'No suspicious URL patterns detected by heuristic analysis.' });
  }

  const level = score <= 15 ? 'safe' : score <= 30 ? 'low' : score <= 50 ? 'medium' : score <= 70 ? 'high' : 'critical';
  return { level, score, findings, dbStatus: 'pending' };
}

export async function checkUrlhaus(url) {
  try {
    const body = new URLSearchParams({ url });
    const res  = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000)
    });
    const json = await res.json();
    if (json.query_status === 'is_host') {
      return { found: true, threat: json.threat || 'malware', tags: json.tags || [] };
    }
    return { found: false };
  } catch {
    return { found: false, error: true };
  }
}

// Async DoH call to retrieve IPs and check for local SSRF threat vectors
async function fetchDomainAAnswers(domain) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.Answer || []).map(r => r.data).filter(Boolean);
  } catch {
    return [];
  }
}

export async function scanSecurity(url) {
  const heuristic = heuristicScan(url);
  
  let parsedUrl;
  let domain = '';
  try {
    parsedUrl = new URL(url);
    domain = parsedUrl.hostname;
  } catch {}

  // Run DB check and DoH check in parallel
  const [db, resolvedIps] = await Promise.all([
    checkUrlhaus(url),
    domain ? fetchDomainAAnswers(domain) : Promise.resolve([])
  ]);

  let finalScore = heuristic.score;
  let finalLevel = heuristic.level;
  let dbStatus   = 'clean';
  const dbFindings = [];

  // 1. Process URLhaus Threat Database matching
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

  // 2. Process DNS SSRF Verification
  let privateIpMatched = false;
  const privateIps = [];
  resolvedIps.forEach(ip => {
    if (isPrivateIP(ip)) {
      privateIpMatched = true;
      privateIps.push(ip);
    }
  });

  if (privateIpMatched) {
    finalScore = Math.min(100, finalScore + 55);
    finalLevel = 'critical';
    dbFindings.push({ type: 'danger', text: `⚠️ Domain resolves to a private or restricted IP address (${privateIps.join(', ')}) — potential Server-Side Request Forgery (SSRF) or internal port scan.` });
  }

  return {
    level: finalLevel,
    score: finalScore,
    findings: [...dbFindings, ...heuristic.findings],
    dbStatus
  };
}
