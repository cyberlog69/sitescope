// @ts-check
// scorecard.js — Composite Security Grade Scorecard Engine (A+ to F)

/**
 * @typedef {'A+'|'A'|'B'|'C'|'D'|'F'} SecurityGrade
 * @typedef {'critical'|'high'|'medium'|'low'} RemediationSeverity
 * 
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   severity: RemediationSeverity,
 *   impact: number
 * }} RemediationItem
 * 
 * @typedef {{
 *   grade: SecurityGrade,
 *   score: number,
 *   strengths: string[],
 *   remediations: RemediationItem[],
 *   badgeClass: string
 * }} ScorecardResult
 */

/**
 * Calculate composite security grade scorecard.
 * @param {object} params
 * @param {string} params.url
 * @param {import('./security.js').ScanResult} [params.securityScan]
 * @param {Record<string, string>} [params.headers]
 * @param {object} [params.sslInfo]
 * @param {object} [params.dnsInfo]
 * @returns {ScorecardResult}
 */
export function calculateSecurityScorecard({ url, securityScan, headers = {}, sslInfo, dnsInfo }) {
  let score = 100;
  const strengths = [];
  /** @type {RemediationItem[]} */
  const remediations = [];

  const isHttps = typeof url === 'string' && url.toLowerCase().startsWith('https://');

  // 1. Protocol Check
  if (isHttps) {
    strengths.push('Enforces encrypted HTTPS protocol.');
  } else {
    score -= 30;
    remediations.push({
      id: 'https-missing',
      title: 'Enable HTTPS Encryption',
      description: 'Site uses unencrypted HTTP. Transmitted data can be intercepted or modified.',
      severity: 'critical',
      impact: 30
    });
  }

  // 2. Threat Scan Penalties
  if (securityScan) {
    const { level, findings = [] } = securityScan;
    if (level === 'critical') {
      score -= 60;
      remediations.push({
        id: 'threat-critical',
        title: 'Resolve Malicious Threat Flag',
        description: 'URL matches known malware/phishing databases or has severe risk signals.',
        severity: 'critical',
        impact: 60
      });
    } else if (level === 'high') {
      score -= 40;
      remediations.push({
        id: 'threat-high',
        title: 'Address High Risk Threats',
        description: 'Strong phishing or brand spoofing signals detected on this URL.',
        severity: 'high',
        impact: 40
      });
    } else if (level === 'medium') {
      score -= 20;
    } else if (level === 'safe') {
      strengths.push('Clean threat database status (URLhaus & Heuristics).');
    }

    // Check specific findings
    findings.forEach(f => {
      if (f.text.includes('homoglyphs')) {
        remediations.push({
          id: 'homoglyph-detected',
          title: 'Homoglyph Character Substitution Flag',
          description: f.text,
          severity: 'high',
          impact: 35
        });
      }
    });
  }

  // 3. HTTP Security Headers Check
  const normHeaders = {};
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      normHeaders[k.toLowerCase()] = String(v);
    }
  }

  // HSTS
  if (normHeaders['strict-transport-security']) {
    strengths.push('Strict-Transport-Security (HSTS) header configured.');
  } else if (isHttps) {
    score -= 10;
    remediations.push({
      id: 'hsts-missing',
      title: 'Configure HSTS Header',
      description: 'Add "Strict-Transport-Security" header to force browsers to connect over HTTPS.',
      severity: 'medium',
      impact: 10
    });
  }

  // CSP
  if (normHeaders['content-security-policy']) {
    strengths.push('Content-Security-Policy (CSP) active.');
  } else {
    score -= 10;
    remediations.push({
      id: 'csp-missing',
      title: 'Implement Content Security Policy (CSP)',
      description: 'Add a "Content-Security-Policy" header to prevent cross-site scripting (XSS) and code injection.',
      severity: 'medium',
      impact: 10
    });
  }

  // X-Frame-Options
  if (normHeaders['x-frame-options']) {
    strengths.push('Clickjacking protection enabled (X-Frame-Options).');
  } else {
    score -= 5;
    remediations.push({
      id: 'xframe-missing',
      title: 'Set X-Frame-Options Header',
      description: 'Set "X-Frame-Options: DENY" or "SAMEORIGIN" to protect against clickjacking attacks.',
      severity: 'low',
      impact: 5
    });
  }

  // Referrer-Policy
  if (normHeaders['referrer-policy']) {
    strengths.push('Referrer Policy configured.');
  } else {
    score -= 5;
    remediations.push({
      id: 'referrer-missing',
      title: 'Configure Referrer-Policy',
      description: 'Set "Referrer-Policy: strict-origin-when-cross-origin" to protect user privacy.',
      severity: 'low',
      impact: 5
    });
  }

  // 4. SSL Certificate Health
  if (sslInfo) {
    if (sslInfo.valid === false || sslInfo.error) {
      score -= 30;
      remediations.push({
        id: 'ssl-invalid',
        title: 'Fix SSL Certificate Issues',
        description: 'SSL certificate is invalid, expired, or untrusted.',
        severity: 'critical',
        impact: 30
      });
    } else if (typeof sslInfo.daysRemaining === 'number') {
      if (sslInfo.daysRemaining <= 14) {
        score -= 15;
        remediations.push({
          id: 'ssl-expiring-soon',
          title: 'Renew Expiring SSL Certificate',
          description: `SSL certificate expires in ${sslInfo.daysRemaining} days. Renew immediately to prevent outage.`,
          severity: 'high',
          impact: 15
        });
      } else {
        strengths.push(`SSL Certificate valid (${sslInfo.daysRemaining} days remaining).`);
      }
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Calculate grade
  /** @type {SecurityGrade} */
  let grade = 'F';
  let badgeClass = 'grade-f';

  if (score >= 95) {
    grade = 'A+'; badgeClass = 'grade-a-plus';
  } else if (score >= 85) {
    grade = 'A';  badgeClass = 'grade-a';
  } else if (score >= 75) {
    grade = 'B';  badgeClass = 'grade-b';
  } else if (score >= 60) {
    grade = 'C';  badgeClass = 'grade-c';
  } else if (score >= 40) {
    grade = 'D';  badgeClass = 'grade-d';
  } else {
    grade = 'F';  badgeClass = 'grade-f';
  }

  return {
    grade,
    score,
    strengths,
    remediations,
    badgeClass
  };
}
