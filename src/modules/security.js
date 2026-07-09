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
  'telegram','discord','dropbox','adobe','salesforce','stripe'
];

const PHISHING_KEYWORDS = [
  'login','signin','sign-in','logon','verify','verification','validate',
  'update','account','secure','security','confirm','banking','bank',
  'password','credential','wallet','recovery','support','helpdesk',
  'suspended','alert','notice','locked','unlock','claim','reward',
  'prize','winner','free','gift','offer','cashback','refund'
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

  // Typosquatting
  const domainBase = hostname.replace(/^www\./, '').split('.')[0];
  const typoHit = KNOWN_BRANDS.find(brand => {
    if (domainBase === brand) return false;
    return levenshtein(domainBase, brand) <= 2 && domainBase.length >= brand.length - 1;
  });
  if (typoHit) {
    score += 25;
    findings.push({ type: 'danger', text: `Domain "${domainBase}" closely resembles "${typoHit}" — possible brand impersonation / typosquatting.` });
  }

  // Known brand exact match
  const isKnownBrand = KNOWN_BRANDS.includes(domainBase);
  if (isKnownBrand) {
    score -= 15;
    findings.push({ type: 'good', text: `Domain matches known brand "${domainBase}" — appears to be the genuine site.` });
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

export async function scanSecurity(url) {
  const heuristic = heuristicScan(url);
  const db = await checkUrlhaus(url);

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

  return {
    level: finalLevel,
    score: finalScore,
    findings: [...dbFindings, ...heuristic.findings],
    dbStatus
  };
}
