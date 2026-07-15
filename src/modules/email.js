// @ts-check
// email.js — Email Validator & Scam Detection module

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

const DISPOSABLE_DOMAINS = new Set([
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

const EMAIL_BRAND_DOMAINS = [
  'paypal','amazon','apple','microsoft','google','facebook','netflix',
  'instagram','twitter','linkedin','dropbox','stripe','shopify',
  'ebay','alibaba','yahoo','gmail','outlook','hotmail','icloud',
  'chase','wellsfargo','bankofamerica','hsbc','barclays','citibank',
  'irs','gov','medicare','socialsecurity','fedex','ups','dhl','usps'
];

/**
 * Validate email format per RFC 5322.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmailFormat(email) {
  const re = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
  return re.test(email);
}

/**
 * Check MX records for a domain via Google DNS-over-HTTPS.
 * @param {string} domain
 * @returns {Promise<{hasMx:boolean|null, count:number, servers:string[], error?:boolean}>}
 */
export async function checkMxRecords(domain) {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await res.json();
    if (json.Status !== 0) return { hasMx: false, count: 0, servers: [] };
    const mx = (json.Answer || []).filter(r => r.type === 15);
    return {
      hasMx: mx.length > 0,
      count: mx.length,
      servers: mx.map(r => r.data.replace(/^\d+ /, '').replace(/\.$/, ''))
    };
  } catch {
    return { hasMx: null, count: 0, servers: [], error: true };
  }
}

/**
 * Heuristic scam scoring for email addresses.
 * @param {string} localPart
 * @param {string} domain
 * @returns {{ score:number, findings:{type:string,text:string}[] }}
 */
export function emailScamScore(localPart, domain) {
  const findings = [];
  let score = 0;

  const domainLower = domain.toLowerCase();
  const localLower  = localPart.toLowerCase();
  const domainBase  = domainLower.split('.')[0];
  const tld         = '.' + domainLower.split('.').slice(1).join('.');

  if (LEGIT_PROVIDERS.has(domainLower)) {
    score -= 20;
    findings.push({ type: 'good', text: `"${domain}" is a well-known, trusted email provider.` });
  }

  const EMAIL_SUSPICIOUS_TLDS = new Set(['.xyz','.top','.tk','.ml','.ga','.cf','.gq','.click',
    '.loan','.stream','.win','.bid','.date','.trade','.review','.cricket','.faith','.party','.zip','.mov']);
  if (EMAIL_SUSPICIOUS_TLDS.has(tld)) {
    score += 28;
    findings.push({ type: 'danger', text: `Domain TLD "${tld}" is commonly used in phishing & scam emails.` });
  }

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

  const numMatch = localLower.match(/\d+/g);
  const numTotal = numMatch ? numMatch.join('').length : 0;
  if (numTotal >= 6) {
    score += 15;
    findings.push({ type: 'warn', text: `Local part contains ${numTotal} digits — may be a generated/bot account.` });
  } else if (numTotal >= 3) {
    score += 6;
  }

  const typoHit = EMAIL_BRAND_DOMAINS.find(brand => {
    if (domainBase === brand) return false;
    return levenshtein(domainBase, brand) <= 2 && domainBase.length >= brand.length - 1;
  });
  if (typoHit) {
    score += 35;
    findings.push({ type: 'danger', text: `Domain "${domainBase}" closely resembles "${typoHit}" — possible brand impersonation.` });
  }

  const brandImpersonation = EMAIL_BRAND_DOMAINS.find(brand =>
    domainLower.includes(brand) && !LEGIT_PROVIDERS.has(domainLower)
  );
  if (brandImpersonation) {
    score += 30;
    findings.push({ type: 'danger', text: `Domain contains "${brandImpersonation}" but is NOT the official domain — strong impersonation signal.` });
  }

  if (/--/.test(domainBase)) {
    score += 12;
    findings.push({ type: 'warn', text: 'Double hyphen in domain — may indicate IDN spoofing trick.' });
  }

  if (/^\d+$/.test(domainBase)) {
    score += 18;
    findings.push({ type: 'warn', text: 'Domain base is entirely numeric — uncommon for legitimate email domains.' });
  }

  if (localPart.length > 30) {
    score += 10;
    findings.push({ type: 'warn', text: `Very long local part (${localPart.length} chars) — unusual for a real email address.` });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

export const EMAIL_VERDICT = {
  clean:    { label: 'Looks Legitimate',    icon: '✅', cls: 'ev-clean',    badgeCls: 'ev-badge-clean',    msg: 'No significant scam signals detected.' },
  low:      { label: 'Low Scam Risk',       icon: '🟡', cls: 'ev-low',     badgeCls: 'ev-badge-low',      msg: 'Minor signals detected. Use with normal caution.' },
  medium:   { label: 'Medium Scam Risk',    icon: '⚠️', cls: 'ev-medium',  badgeCls: 'ev-badge-medium',   msg: 'Several risk signals. Verify sender identity before responding.' },
  high:     { label: 'High Scam Risk',      icon: '🔴', cls: 'ev-high',    badgeCls: 'ev-badge-high',     msg: 'Strong indicators of phishing or scam email.' },
  critical: { label: 'Scam / Fraud Alert',  icon: '🚨', cls: 'ev-critical', badgeCls: 'ev-badge-critical', msg: 'DANGER: Multiple scam/fraud indicators detected. Do NOT engage.' },
  invalid:  { label: 'Invalid Email',       icon: '❌', cls: 'ev-high',    badgeCls: 'ev-badge-invalid',  msg: 'Not a valid email address format.' },
  disposable:{ label: 'Disposable Email',   icon: '🗑️', cls: 'ev-medium',  badgeCls: 'ev-badge-medium',   msg: 'Temporary/disposable address — avoid for important communications.' }
};

/**
 * Determine email verdict label based on score and flags.
 * @param {number} score
 * @param {boolean} isDisposableFlag
 * @param {boolean} formatOk
 * @returns {string}
 */
export function getVerdict(score, isDisposableFlag, formatOk) {
  if (!formatOk) return 'invalid';
  if (isDisposableFlag) return 'disposable';
  if (score <= 10) return 'clean';
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 70) return 'high';
  return 'critical';
}

/**
 * Map a verdict string to a CSS class for the score fill bar.
 * @param {string} verdict
 * @returns {string}
 */
export function emailScoreFillCls(verdict) {
  const map = { clean:'sec-fill-safe', low:'sec-fill-low', medium:'sec-fill-medium',
                high:'sec-fill-high', critical:'sec-fill-critical',
                invalid:'sec-fill-high', disposable:'sec-fill-medium' };
  return map[verdict] || 'sec-fill-medium';
}

/**
 * Full email check: format, disposable domain, MX records, scam score.
 * @param {string} email
 * @returns {Promise<{email:string, localPart:string, domain:string, formatOk:boolean,
 *   isDisposableFlag:boolean, mx:{hasMx:boolean|null, count:number, servers:string[]},
 *   scam:{score:number, findings:{type:string,text:string}[]},
 *   verdict:string, verdictMeta:{label:string, icon:string, cls:string, badgeCls:string, msg:string}}>}
 */
export async function checkEmail(email) {
  const formatOk = isValidEmailFormat(email);
  const atIdx    = email.lastIndexOf('@');
  const localPart = atIdx > -1 ? email.slice(0, atIdx) : email;
  const domain    = atIdx > -1 ? email.slice(atIdx + 1).toLowerCase() : '';

  const isDisposableFlag = DISPOSABLE_DOMAINS.has(domain);
  const mx = formatOk && domain ? await checkMxRecords(domain) : { hasMx: false, count: 0, servers: [], error: false };
  const scam = (formatOk && domain) ? emailScamScore(localPart, domain) : { score: 0, findings: [] };

  if (mx.hasMx === false && !mx.error && formatOk) {
    scam.score = Math.min(100, scam.score + 30);
    scam.findings.unshift({ type: 'danger', text: 'No MX records found — this domain cannot receive emails.' });
  } else if (mx.hasMx === true) {
    scam.findings.unshift({ type: 'good', text: `Domain has ${mx.count} active mail server${mx.count > 1 ? 's' : ''}: ${mx.servers.slice(0,2).join(', ')}${mx.count > 2 ? '…' : ''}` });
  }

  const verdict     = getVerdict(scam.score, isDisposableFlag, formatOk);
  const verdictMeta = EMAIL_VERDICT[verdict];

  return { email, localPart, domain, formatOk, isDisposableFlag, mx, scam, verdict, verdictMeta };
}
