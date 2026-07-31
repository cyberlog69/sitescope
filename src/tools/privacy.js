// @ts-check
// privacy.js — Cookie Consent & Privacy Policy Inspector (GDPR / CCPA Audit)

/**
 * @typedef {{
 *   hasPrivacyPolicy: boolean,
 *   privacyPolicyUrl: string | null,
 *   cmpDetected: { name: string, type: 'cmp' | 'custom' } | null,
 *   thirdPartyTrackers: string[],
 *   complianceScore: number,
 *   complianceLevel: 'PASS' | 'WARNING' | 'FAIL',
 *   findings: Array<{ severity: 'high' | 'medium' | 'low' | 'info', message: string }>
 * }} PrivacyAuditResult
 */

const KNOWN_CMPS = [
  { name: 'OneTrust', pattern: /onetrust|optanon|cookielaw|otsdkstub/i },
  { name: 'Cookiebot', pattern: /cookiebot/i },
  { name: 'Osano', pattern: /osano/i },
  { name: 'Quantcast Choice', pattern: /quantcast|choice\.js/i },
  { name: 'Usercentrics', pattern: /usercentrics/i },
  { name: 'Klaro', pattern: /klaro/i },
  { name: 'TrustArc', pattern: /truste|trustarc/i },
  { name: 'CookieYes', pattern: /cookieyes/i },
  { name: 'Iubenda', pattern: /iubenda/i }
];

const KNOWN_TRACKERS = [
  { name: 'Google Analytics', pattern: /google-analytics|googletagmanager|gtag|ga\.js/i },
  { name: 'Meta / Facebook Pixel', pattern: /connect\.facebook\.net|fbevents\.js/i },
  { name: 'Hotjar', pattern: /static\.hotjar\.com/i },
  { name: 'TikTok Pixel', pattern: /analytics\.tiktok\.com/i },
  { name: 'Mixpanel', pattern: /cdn\.mxpnl\.com|mixpanel/i },
  { name: 'Segment', pattern: /cdn\.segment\.com/i },
  { name: 'HubSpot', pattern: /js\.hs-scripts\.com|track\.hubspot\.com/i },
  { name: 'LinkedIn Insight Tag', pattern: /snap\.licdn\.com/i }
];

/**
 * Audit Privacy Policy, Cookie Consent Banner, and Third-Party Trackers from HTML and Headers.
 * @param {string} html
 * @param {Record<string, string>} [headers]
 * @param {string} [baseUrl]
 * @returns {PrivacyAuditResult}
 */
export function auditPrivacyAndConsent(html, headers, baseUrl = '') {
  const htmlContent = html || '';
  /** @type {Array<{ severity: 'high' | 'medium' | 'low' | 'info', message: string }>} */
  const findings = [];

  // 1. Discover Privacy Policy Link
  let hasPrivacyPolicy = false;
  /** @type {string|null} */
  let privacyPolicyUrl = null;

  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1];
    const text = match[2].toLowerCase();
    if (/privacy|data-protection|terms-and-conditions|privacy-policy/i.test(href) || /privacy policy|privacy notice|data protection/i.test(text)) {
      hasPrivacyPolicy = true;
      try {
        privacyPolicyUrl = new URL(href, baseUrl || 'https://example.com').href;
      } catch {
        privacyPolicyUrl = href;
      }
      break;
    }
  }

  if (!hasPrivacyPolicy) {
    findings.push({ severity: 'high', message: 'No explicit Privacy Policy link discovered on page.' });
  }

  // 2. Consent Management Platform (CMP) or Cookie Banner Detection
  /** @type {{ name: string, type: 'cmp' | 'custom' } | null} */
  let cmpDetected = null;

  for (const cmp of KNOWN_CMPS) {
    if (cmp.pattern.test(htmlContent)) {
      cmpDetected = { name: cmp.name, type: 'cmp' };
      break;
    }
  }

  if (!cmpDetected) {
    if (/cookie-banner|cookie-consent|cookie-notice|consent-modal|gdpr-banner|cookieNotice/i.test(htmlContent)) {
      cmpDetected = { name: 'Custom Cookie Banner', type: 'custom' };
    }
  }

  if (cmpDetected) {
    findings.push({ severity: 'info', message: `Cookie Consent Banner detected (${cmpDetected.name}).` });
  } else {
    findings.push({ severity: 'medium', message: 'No Cookie Consent Management Platform (CMP) banner detected.' });
  }

  // 3. Third-Party Tracker Fingerprinting
  const thirdPartyTrackers = [];
  for (const tracker of KNOWN_TRACKERS) {
    if (tracker.pattern.test(htmlContent)) {
      thirdPartyTrackers.push(tracker.name);
    }
  }

  if (thirdPartyTrackers.length > 0 && !cmpDetected) {
    findings.push({ severity: 'high', message: `${thirdPartyTrackers.length} third-party tracker(s) detected without an active Cookie Consent Banner.` });
  }

  // 4. Compliance Score & Level Evaluation
  let score = 100;
  if (!hasPrivacyPolicy) score -= 40;
  if (!cmpDetected) score -= 30;
  if (thirdPartyTrackers.length > 0 && !cmpDetected) score -= 20;

  const complianceScore = Math.max(0, score);
  /** @type {'PASS' | 'WARNING' | 'FAIL'} */
  let complianceLevel = 'FAIL';
  if (complianceScore >= 80) complianceLevel = 'PASS';
  else if (complianceScore >= 50) complianceLevel = 'WARNING';

  return {
    hasPrivacyPolicy,
    privacyPolicyUrl,
    cmpDetected,
    thirdPartyTrackers,
    complianceScore,
    complianceLevel,
    findings
  };
}
