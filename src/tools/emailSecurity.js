// @ts-check
// emailSecurity.js — Email Security & Domain Authentication Auditor (DMARC, SPF, DKIM, DNSSEC & BIMI)

import { logWarn } from '../utils/logger.js';

/**
 * @typedef {{
 *   domain: string,
 *   hasMx: boolean,
 *   mxRecords: string[],
 *   mailProvider: string,
 *   dmarc: {
 *     present: boolean,
 *     raw: string | null,
 *     policy: 'reject' | 'quarantine' | 'none' | 'missing',
 *     rua: string | null,
 *     ruf: string | null,
 *     pct: number,
 *     adkim: 'r' | 's' | null,
 *     aspf: 'r' | 's' | null,
 *     valid: boolean
 *   },
 *   spf: {
 *     present: boolean,
 *     raw: string | null,
 *     qualifier: '-all' | '~all' | '?all' | '+all' | 'missing',
 *     mechanisms: string[],
 *     lookupCountEstimate: number,
 *     valid: boolean
 *   },
 *   dnssec: {
 *     enabled: boolean,
 *     authenticatedData: boolean
 *   },
 *   bimi: {
 *     present: boolean,
 *     raw: string | null,
 *     logoUrl: string | null,
 *     hasVmc: boolean
 *   },
 *   mtaSts: {
 *     present: boolean,
 *     raw: string | null
 *   },
 *   spoofingRiskScore: number,
 *   authGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
 *   checklist: Array<{ pass: boolean, severity: 'critical' | 'warning' | 'info' | 'good', label: string, hint: string }>,
 *   recommendedDmarc: string,
 *   recommendedSpf: string
 * }} EmailSecurityResult
 */

/**
 * Identify primary email provider from MX hostnames.
 * @param {string[]} mxHosts
 * @returns {string}
 */
export function identifyMailProvider(mxHosts = []) {
  const joined = mxHosts.join(' ').toLowerCase();
  if (joined.includes('google') || joined.includes('aspmx') || joined.includes('googlemail')) return 'Google Workspace / Gmail';
  if (joined.includes('outlook') || joined.includes('microsoft') || joined.includes('office365')) return 'Microsoft 365 / Exchange';
  if (joined.includes('protonmail') || joined.includes('proton')) return 'Proton Mail';
  if (joined.includes('mimecast')) return 'Mimecast';
  if (joined.includes('proofpoint') || joined.includes('pphosted')) return 'Proofpoint';
  if (joined.includes('zoho')) return 'Zoho Mail';
  if (joined.includes('fastmail')) return 'Fastmail';
  if (joined.includes('amazonses') || joined.includes('aws')) return 'Amazon SES';
  if (joined.includes('sendgrid')) return 'SendGrid';
  if (joined.includes('mailgun')) return 'Mailgun';
  if (joined.includes('cloudflare')) return 'Cloudflare Email Routing';
  if (mxHosts.length > 0) return 'Custom / Private Mail Server';
  return 'No MX Records (Email Disabled or Inactive)';
}

/**
 * Parse DMARC TXT record.
 * @param {string | null} raw
 * @returns {EmailSecurityResult['dmarc']}
 */
export function parseDmarcRecord(raw) {
  if (!raw || !raw.toLowerCase().includes('v=dmarc1')) {
    return {
      present: false,
      raw: null,
      policy: 'missing',
      rua: null,
      ruf: null,
      pct: 100,
      adkim: null,
      aspf: null,
      valid: false
    };
  }

  // Clean raw record
  const cleaned = raw.replace(/^"|"$/g, '').trim();
  const tags = {};
  cleaned.split(';').forEach((part) => {
    const [key, ...vals] = part.trim().split('=');
    if (key && vals.length) {
      tags[key.trim().toLowerCase()] = vals.join('=').trim();
    }
  });

  const pRaw = (tags['p'] || '').toLowerCase();
  /** @type {'reject' | 'quarantine' | 'none' | 'missing'} */
  let policy = 'none';
  if (pRaw === 'reject') policy = 'reject';
  else if (pRaw === 'quarantine') policy = 'quarantine';
  else if (pRaw === 'none') policy = 'none';

  return {
    present: true,
    raw: cleaned,
    policy,
    rua: tags['rua'] || null,
    ruf: tags['ruf'] || null,
    pct: tags['pct'] ? parseInt(tags['pct'], 10) || 100 : 100,
    adkim: tags['adkim'] === 's' ? 's' : 'r',
    aspf: tags['aspf'] === 's' ? 's' : 'r',
    valid: Boolean(tags['v'] && tags['p'])
  };
}

/**
 * Parse SPF TXT record.
 * @param {string | null} raw
 * @returns {EmailSecurityResult['spf']}
 */
export function parseSpfRecord(raw) {
  if (!raw || !raw.toLowerCase().startsWith('v=spf1')) {
    return {
      present: false,
      raw: null,
      qualifier: 'missing',
      mechanisms: [],
      lookupCountEstimate: 0,
      valid: false
    };
  }

  const cleaned = raw.replace(/^"|"$/g, '').trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const mechanisms = tokens.slice(1);

  let qualifier = 'missing';
  let lookups = 0;

  mechanisms.forEach((m) => {
    const lower = m.toLowerCase();
    if (lower.endsWith('all')) {
      if (lower === '-all') qualifier = '-all';
      else if (lower === '~all') qualifier = '~all';
      else if (lower === '?all') qualifier = '?all';
      else if (lower === '+all' || lower === 'all') qualifier = '+all';
    }

    if (
      lower.startsWith('include:') ||
      lower.startsWith('a') ||
      lower.startsWith('mx') ||
      lower.startsWith('ptr') ||
      lower.startsWith('exists:') ||
      lower.startsWith('redirect=')
    ) {
      lookups += 1;
    }
  });

  return {
    present: true,
    raw: cleaned,
    // @ts-ignore
    qualifier,
    mechanisms,
    lookupCountEstimate: lookups,
    valid: true
  };
}

/**
 * Audit DNS data and compute Email Security and Domain Auth grade.
 * @param {Object} dnsData
 * @param {string} domain
 * @returns {EmailSecurityResult}
 */
export function auditEmailSecurity(dnsData, domain = '') {
  const mxRecords = Array.isArray(dnsData.mx) ? dnsData.mx : [];
  const hasMx = mxRecords.length > 0;
  const mailProvider = identifyMailProvider(mxRecords);

  const dmarc = parseDmarcRecord(dnsData.dmarcTxt || null);
  const spf = parseSpfRecord(dnsData.spfTxt || null);
  const dnssec = {
    enabled: Boolean(dnsData.dnssecAd || dnsData.hasDnssec),
    authenticatedData: Boolean(dnsData.dnssecAd)
  };

  // BIMI parsing
  const bimiRaw = dnsData.bimiTxt ? dnsData.bimiTxt.replace(/^"|"$/g, '').trim() : null;
  const hasBimi = Boolean(bimiRaw && bimiRaw.toLowerCase().includes('v=bimi1'));
  let bimiLogo = null;
  let hasVmc = false;
  if (hasBimi && bimiRaw) {
    const lMatch = bimiRaw.match(/l=([^;]+)/i);
    const aMatch = bimiRaw.match(/a=([^;]+)/i);
    bimiLogo = lMatch ? lMatch[1].trim() : null;
    hasVmc = Boolean(aMatch && aMatch[1].trim());
  }

  const bimi = {
    present: hasBimi,
    raw: bimiRaw,
    logoUrl: bimiLogo,
    hasVmc
  };

  // MTA-STS parsing
  const mtaStsRaw = dnsData.mtaStsTxt ? dnsData.mtaStsTxt.replace(/^"|"$/g, '').trim() : null;
  const hasMtaSts = Boolean(mtaStsRaw && mtaStsRaw.toLowerCase().includes('v=stsv1'));
  const mtaSts = {
    present: hasMtaSts,
    raw: mtaStsRaw
  };

  // Risk Score & Checklist Calculation
  /** @type {EmailSecurityResult['checklist']} */
  const checklist = [];
  let riskScore = 0; // 0 = lowest risk / safe, 100 = critical risk

  // DMARC Check
  if (!dmarc.present) {
    riskScore += 45;
    checklist.push({
      pass: false,
      severity: 'critical',
      label: 'DMARC Policy Missing',
      hint: 'Attackers can spoof this domain in email phishing attacks. Publish a DMARC TXT record.'
    });
  } else if (dmarc.policy === 'none') {
    riskScore += 25;
    checklist.push({
      pass: false,
      severity: 'warning',
      label: 'DMARC Policy is Monitoring Only (p=none)',
      hint: 'Spoofed emails will still be delivered to recipient inboxes. Upgrade policy to p=quarantine or p=reject.'
    });
  } else if (dmarc.policy === 'quarantine') {
    riskScore += 10;
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'DMARC Policy Enforced (p=quarantine)',
      hint: 'Spoofed emails are redirected to spam folders.'
    });
  } else if (dmarc.policy === 'reject') {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'DMARC Strict Rejection (p=reject)',
      hint: 'Maximum protection: spoofed emails are immediately blocked.'
    });
  }

  // DMARC Reporting (RUA)
  if (dmarc.present && !dmarc.rua) {
    riskScore += 5;
    checklist.push({
      pass: false,
      severity: 'warning',
      label: 'DMARC Aggregate Reporting Missing (rua=)',
      hint: 'Add a rua=mailto: destination to receive forensic reports on spoofing attempts.'
    });
  }

  // SPF Check
  if (!spf.present) {
    riskScore += 35;
    checklist.push({
      pass: false,
      severity: 'critical',
      label: 'SPF Record Missing',
      hint: 'No authorized mail servers defined. Publish an SPF record to specify valid senders.'
    });
  } else if (spf.qualifier === '+all' || spf.qualifier === '?all') {
    riskScore += 20;
    checklist.push({
      pass: false,
      severity: 'critical',
      label: `Permissive SPF Qualifier (${spf.qualifier})`,
      hint: `Using ${spf.qualifier} allows unauthorized senders to pass SPF validation. Use -all or ~all.`
    });
  } else if (spf.qualifier === '~all') {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'SPF SoftFail Configured (~all)',
      hint: 'Standard SPF policy with soft-fail for unauthorized senders.'
    });
  } else if (spf.qualifier === '-all') {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'SPF HardFail Enforced (-all)',
      hint: 'Strict SPF enforcement: non-listed senders will fail authentication.'
    });
  }

  // SPF DNS Lookups
  if (spf.present && spf.lookupCountEstimate > 10) {
    riskScore += 10;
    checklist.push({
      pass: false,
      severity: 'warning',
      label: `SPF Lookup Limit Exceeded (${spf.lookupCountEstimate}/10)`,
      hint: 'RFC 7208 limits SPF lookups to 10. Exceeding this causes PermError and mail delivery failures.'
    });
  }

  // DNSSEC Check
  if (!dnssec.enabled) {
    riskScore += 10;
    checklist.push({
      pass: false,
      severity: 'info',
      label: 'DNSSEC Inactive / Not Enabled',
      hint: 'Enable DNSSEC at your registrar to prevent DNS spoofing and cache poisoning.'
    });
  } else {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'DNSSEC Cryptographically Active',
      hint: 'DNS records are cryptographically signed and authenticated.'
    });
  }

  // BIMI Check
  if (bimi.present) {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'BIMI Brand Indicator Configured',
      hint: bimi.hasVmc ? 'BIMI logo with Verified Mark Certificate (VMC) detected.' : 'BIMI logo configured (VMC recommended for Gmail).'
    });
  } else {
    checklist.push({
      pass: false,
      severity: 'info',
      label: 'BIMI Not Configured',
      hint: 'Configure BIMI to display your verified company logo in Gmail/Apple Mail inboxes.'
    });
  }

  // MTA-STS Check
  if (mtaSts.present) {
    checklist.push({
      pass: true,
      severity: 'good',
      label: 'MTA-STS SMTP Encryption Enforced',
      hint: 'Enforces TLS encryption for incoming emails and prevents MITM attacks.'
    });
  }

  // Compute Auth Grade
  const spoofingRiskScore = Math.min(100, Math.max(0, riskScore));
  /** @type {'A+' | 'A' | 'B' | 'C' | 'D' | 'F'} */
  let authGrade = 'F';
  if (spoofingRiskScore <= 5 && dmarc.policy === 'reject' && (spf.qualifier === '-all' || spf.qualifier === '~all')) authGrade = 'A+';
  else if (spoofingRiskScore <= 15 && (dmarc.policy === 'reject' || dmarc.policy === 'quarantine')) authGrade = 'A';
  else if (spoofingRiskScore <= 35) authGrade = 'B';
  else if (spoofingRiskScore <= 55) authGrade = 'C';
  else if (spoofingRiskScore <= 75) authGrade = 'D';

  const recommendedDmarc = `_dmarc.${domain || 'example.com'}. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc-reports@${domain || 'example.com'}; pct=100; adkim=s; aspf=s;"`;
  const recommendedSpf = `${domain || 'example.com'}. IN TXT "v=spf1 include:_spf.google.com ~all"`;

  return {
    domain,
    hasMx,
    mxRecords,
    mailProvider,
    dmarc,
    spf,
    dnssec,
    bimi,
    mtaSts,
    spoofingRiskScore,
    authGrade,
    checklist,
    recommendedDmarc,
    recommendedSpf
  };
}

/**
 * Fetch DNS records via Google DNS-over-HTTPS (DoH) and perform audit.
 * @param {string} domain
 * @returns {Promise<EmailSecurityResult>}
 */
export async function fetchEmailSecurity(domain) {
  if (!domain) return auditEmailSecurity({}, '');

  /**
   * Helper to query Google DoH for record type.
   * @param {string} name
   * @param {string} type
   * @returns {Promise<any>}
   */
  async function queryDoh(name, type) {
    try {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&do=true`;
      const res = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      logWarn(`doh:${type}:${name}`, err);
      return null;
    }
  }

  try {
    const [dmarcRes, txtRes, mxRes, bimiRes, mtaStsRes] = await Promise.all([
      queryDoh(`_dmarc.${domain}`, 'TXT'),
      queryDoh(domain, 'TXT'),
      queryDoh(domain, 'MX'),
      queryDoh(`default._bimi.${domain}`, 'TXT'),
      queryDoh(`_mta-sts.${domain}`, 'TXT')
    ]);

    // Extract DMARC TXT
    let dmarcTxt = null;
    if (dmarcRes && Array.isArray(dmarcRes.Answer)) {
      const ans = dmarcRes.Answer.find((/** @type {any} */ a) => a.data && a.data.includes('v=DMARC1'));
      if (ans) dmarcTxt = ans.data;
    }

    // Extract SPF TXT
    let spfTxt = null;
    if (txtRes && Array.isArray(txtRes.Answer)) {
      const ans = txtRes.Answer.find((/** @type {any} */ a) => a.data && a.data.includes('v=spf1'));
      if (ans) spfTxt = ans.data;
    }

    // Extract MX records
    const mx = [];
    if (mxRes && Array.isArray(mxRes.Answer)) {
      mxRes.Answer.forEach((/** @type {any} */ a) => {
        if (a.data) {
          const parts = a.data.split(' ');
          const host = parts.length > 1 ? parts[1] : parts[0];
          mx.push(host.replace(/\.$/, ''));
        }
      });
    }

    // Extract BIMI TXT
    let bimiTxt = null;
    if (bimiRes && Array.isArray(bimiRes.Answer)) {
      const ans = bimiRes.Answer.find((/** @type {any} */ a) => a.data && a.data.includes('v=BIMI1'));
      if (ans) bimiTxt = ans.data;
    }

    // Extract MTA-STS TXT
    let mtaStsTxt = null;
    if (mtaStsRes && Array.isArray(mtaStsRes.Answer)) {
      const ans = mtaStsRes.Answer.find((/** @type {any} */ a) => a.data && a.data.includes('v=STSv1'));
      if (ans) mtaStsTxt = ans.data;
    }

    // DNSSEC Authenticated Data flag
    const dnssecAd = Boolean(txtRes && txtRes.AD);

    return auditEmailSecurity(
      {
        dmarcTxt,
        spfTxt,
        mx,
        bimiTxt,
        mtaStsTxt,
        dnssecAd
      },
      domain
    );
  } catch (err) {
    logWarn('fetchEmailSecurity', err);
    return auditEmailSecurity({}, domain);
  }
}
