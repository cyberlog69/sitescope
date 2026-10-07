// @ts-check
// deepSecurity.js — Deep Security & Infrastructure Hardening Module (Phase 1)
// Automated AST CSP Evaluator, HSTS Preload Validator, Cookie Hygiene, Sensitive Leaks & Snippet Generator

import { escapeHtml } from '../utils/helpers.js';
import { fetchViaCorsProxy } from '../utils/proxy.js';
import { logWarn } from '../utils/logger.js';

/**
 * @typedef {{
 *   raw: string,
 *   directives: Record<string, string[]>,
 *   directiveCount: number,
 *   hasDefaultSrc: boolean,
 *   hasScriptSrc: boolean,
 *   unsafeInline: boolean,
 *   unsafeEval: boolean,
 *   objectSrcNone: boolean,
 *   baseUriRestricted: boolean,
 *   frameAncestorsRestricted: boolean,
 *   wildcardSources: string[],
 *   upgradeInsecureRequests: boolean,
 *   score: number,
 *   status: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'CRITICAL' | 'MISSING',
 *   findings: Array<{ severity: 'critical' | 'high' | 'medium' | 'low' | 'good', message: string, directive?: string }>
 * }} CspAuditResult
 */

/**
 * @typedef {{
 *   raw: string,
 *   present: boolean,
 *   maxAge: number,
 *   maxAgeDays: number,
 *   includeSubDomains: boolean,
 *   preload: boolean,
 *   isPreloadEligible: boolean,
 *   score: number,
 *   status: 'PRELOAD_READY' | 'ENFORCED' | 'WEAK' | 'MISSING',
 *   findings: Array<{ severity: 'critical' | 'high' | 'medium' | 'low' | 'good', message: string }>
 * }} HstsAuditResult
 */

/**
 * @typedef {{
 *   name: string,
 *   valueMasked: string,
 *   isSecure: boolean,
 *   isHttpOnly: boolean,
 *   sameSite: 'Strict' | 'Lax' | 'None' | 'Missing',
 *   isPrefixSecure: boolean,
 *   findings: string[]
 * }} AuditedCookie
 */

/**
 * @typedef {{
 *   total: number,
 *   cookies: AuditedCookie[],
 *   allSecure: boolean,
 *   allHttpOnly: boolean,
 *   allSameSite: boolean,
 *   score: number,
 *   status: 'HARDENED' | 'FAIR' | 'RISK' | 'NO_COOKIES',
 *   findings: Array<{ severity: 'high' | 'medium' | 'low' | 'good', message: string }>
 * }} CookieAuditResult
 */

/**
 * @typedef {{
 *   raw: string,
 *   present: boolean,
 *   features: Record<string, string[]>,
 *   restrictedCount: number,
 *   score: number,
 *   status: 'HARDENED' | 'PARTIAL' | 'PERMISSIVE' | 'MISSING',
 *   findings: Array<{ severity: 'high' | 'medium' | 'low' | 'good', message: string }>
 * }} PermissionsPolicyResult
 */

/**
 * @typedef {{
 *   path: string,
 *   title: string,
 *   severity: 'CRITICAL' | 'HIGH' | 'MEDIUM',
 *   status: 'CLEAN' | 'EXPOSED' | 'UNVERIFIED',
 *   evidence: string | null
 * }} SensitiveLeakProbe
 */

/**
 * @typedef {{
 *   probes: SensitiveLeakProbe[],
 *   exposedCount: number,
 *   cleanCount: number,
 *   score: number,
 *   hasCriticalExposure: boolean
 * }} SensitiveLeaksResult
 */

/**
 * @typedef {{
 *   nginx: string,
 *   apache: string,
 *   vercel: string,
 *   caddy: string
 * }} ServerSnippets
 */

/**
 * @typedef {{
 *   domain: string,
 *   overallScore: number,
 *   grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
 *   csp: CspAuditResult,
 *   hsts: HstsAuditResult,
 *   permissionsPolicy: PermissionsPolicyResult,
 *   cookies: CookieAuditResult,
 *   sensitiveLeaks: SensitiveLeaksResult,
 *   fundamentalHeaders: {
 *     xContentTypeOptions: boolean,
 *     xFrameOptions: string | null,
 *     referrerPolicy: string | null,
 *     crossOriginOpenerPolicy: string | null
 *   },
 *   snippets: ServerSnippets,
 *   actionableFixes: Array<{ severity: 'critical' | 'high' | 'medium' | 'low', title: string, hint: string }>
 * }} DeepSecurityResult
 */

/**
 * Parse and evaluate Content-Security-Policy header string via AST tokens.
 * @param {string|null|undefined} cspHeader
 * @returns {CspAuditResult}
 */
export function parseAndEvaluateCsp(cspHeader) {
  const raw = (cspHeader || '').trim();
  /** @type {Record<string, string[]>} */
  const directives = {};
  /** @type {CspAuditResult['findings']} */
  const findings = [];

  if (!raw) {
    findings.push({
      severity: 'critical',
      message: 'No Content-Security-Policy (CSP) header detected. Vulnerable to XSS and injection attacks.'
    });
    return {
      raw: '',
      directives: {},
      directiveCount: 0,
      hasDefaultSrc: false,
      hasScriptSrc: false,
      unsafeInline: false,
      unsafeEval: false,
      objectSrcNone: false,
      baseUriRestricted: false,
      frameAncestorsRestricted: false,
      wildcardSources: [],
      upgradeInsecureRequests: false,
      score: 0,
      status: 'MISSING',
      findings
    };
  }

  // Tokenize directives by semicolon
  const parts = raw.split(';').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    const sources = tokens.slice(1);
    directives[name] = sources;
  }

  const directiveCount = Object.keys(directives).length;
  const hasDefaultSrc = 'default-src' in directives;

  // Unsafe inline detection in script sources
  const scriptSources = directives['script-src'] || directives['default-src'] || [];
  const unsafeInline = scriptSources.some(s => s.toLowerCase() === "'unsafe-inline'");
  const unsafeEval = scriptSources.some(s => s.toLowerCase() === "'unsafe-eval'");

  // Object-src restriction
  const objectSources = directives['object-src'] || (hasDefaultSrc ? directives['default-src'] : []);
  const objectSrcNone = objectSources.some(s => s.toLowerCase() === "'none'");

  // Base-URI check
  const baseUriSources = directives['base-uri'] || [];
  const baseUriRestricted = baseUriSources.length > 0 && !baseUriSources.includes('*');

  // Frame ancestors (Clickjacking defense)
  const frameAncestors = directives['frame-ancestors'] || [];
  const frameAncestorsRestricted = frameAncestors.length > 0;

  // Wildcards in active network directives
  const wildcardSources = [];
  const networkDirectives = ['script-src', 'connect-src', 'style-src', 'default-src', 'img-src'];
  for (const dir of networkDirectives) {
    if (directives[dir] && directives[dir].some(s => s === '*' || s.startsWith('http:'))) {
      wildcardSources.push(dir);
    }
  }

  const upgradeInsecureRequests = 'upgrade-insecure-requests' in directives;

  // Scoring AST CSP
  let score = 100;

  if (unsafeInline) {
    score -= 30;
    findings.push({
      severity: 'critical',
      directive: 'script-src',
      message: "Direct 'unsafe-inline' detected in script execution policy. Enables arbitrary Cross-Site Scripting (XSS)."
    });
  } else {
    findings.push({
      severity: 'good',
      directive: 'script-src',
      message: "Scripts do not use permissive 'unsafe-inline' without nonces."
    });
  }

  if (unsafeEval) {
    score -= 15;
    findings.push({
      severity: 'high',
      directive: 'script-src',
      message: "'unsafe-eval' detected. Permits dynamic string code execution (eval, Function constructors)."
    });
  }

  if (!hasDefaultSrc) {
    score -= 20;
    findings.push({
      severity: 'high',
      directive: 'default-src',
      message: "Missing 'default-src' fallback directive. Unspecified fetch types will fall back to open defaults."
    });
  } else {
    findings.push({
      severity: 'good',
      directive: 'default-src',
      message: "Explicit 'default-src' fallback is defined."
    });
  }

  if (!objectSrcNone) {
    score -= 15;
    findings.push({
      severity: 'medium',
      directive: 'object-src',
      message: "Missing 'object-src 'none''. Allows legacy browser plugins, Applets, or Flash execution."
    });
  } else {
    findings.push({
      severity: 'good',
      directive: 'object-src',
      message: "'object-src 'none'' successfully blocks legacy plugin execution."
    });
  }

  if (!baseUriRestricted) {
    score -= 10;
    findings.push({
      severity: 'medium',
      directive: 'base-uri',
      message: "Missing or unconstrained 'base-uri'. Allows attacker to inject <base> tags and hijack relative URLs."
    });
  }

  if (wildcardSources.length > 0) {
    score -= 15;
    findings.push({
      severity: 'high',
      message: `Permissive wildcard '*' or unencrypted 'http:' detected in: ${wildcardSources.join(', ')}.`
    });
  }

  if (upgradeInsecureRequests) {
    findings.push({
      severity: 'good',
      directive: 'upgrade-insecure-requests',
      message: "'upgrade-insecure-requests' active: automatically rewrites legacy HTTP URLs to HTTPS."
    });
  }

  score = Math.max(0, Math.min(100, score));

  /** @type {CspAuditResult['status']} */
  let status = 'CRITICAL';
  if (score >= 90) status = 'EXCELLENT';
  else if (score >= 70) status = 'GOOD';
  else if (score >= 45) status = 'NEEDS_IMPROVEMENT';

  return {
    raw,
    directives,
    directiveCount,
    hasDefaultSrc,
    hasScriptSrc: 'script-src' in directives || 'script-src-elem' in directives,
    unsafeInline,
    unsafeEval,
    objectSrcNone,
    baseUriRestricted,
    frameAncestorsRestricted,
    wildcardSources,
    upgradeInsecureRequests,
    score,
    status,
    findings
  };
}

/**
 * Evaluate HSTS header against RFC 6797 and Chromium Preload List criteria.
 * @param {string|null|undefined} hstsHeader
 * @param {boolean} [isHttps=true]
 * @returns {HstsAuditResult}
 */
export function evaluateHsts(hstsHeader, isHttps = true) {
  const raw = (hstsHeader || '').trim();
  /** @type {HstsAuditResult['findings']} */
  const findings = [];

  if (!raw) {
    findings.push({
      severity: 'critical',
      message: 'No Strict-Transport-Security (HSTS) header found. Vulnerable to SSL stripping and downgrade attacks.'
    });
    return {
      raw: '',
      present: false,
      maxAge: 0,
      maxAgeDays: 0,
      includeSubDomains: false,
      preload: false,
      isPreloadEligible: false,
      score: 0,
      status: 'MISSING',
      findings
    };
  }

  const maxAgeMatch = raw.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const maxAgeDays = Math.floor(maxAge / 86400);

  const includeSubDomains = /includeSubDomains/i.test(raw);
  const preload = /preload/i.test(raw);

  // Chromium / Safari Preload criteria: HTTPS + max-age >= 1 yr + includeSubDomains + preload
  const isPreloadEligible = isHttps && maxAge >= 31536000 && includeSubDomains && preload;

  let score = 0;
  if (maxAge >= 63072000) {
    score += 45;
    findings.push({ severity: 'good', message: `Strong max-age: ${maxAgeDays} days (${maxAge}s).` });
  } else if (maxAge >= 31536000) {
    score += 40;
    findings.push({ severity: 'good', message: `Adequate max-age: ${maxAgeDays} days (${maxAge}s). Meets 1-year preload requirement.` });
  } else if (maxAge > 0) {
    score += 20;
    findings.push({ severity: 'medium', message: `Low max-age: ${maxAgeDays} days. Preload requires at least 31536000s (1 year).` });
  } else {
    findings.push({ severity: 'high', message: 'HSTS max-age is 0 or invalid, disabling transport encryption enforcement.' });
  }

  if (includeSubDomains) {
    score += 30;
    findings.push({ severity: 'good', message: "'includeSubDomains' is active. Protects all nested subdomains from downgrade attacks." });
  } else {
    findings.push({ severity: 'medium', message: "Missing 'includeSubDomains'. Subdomains remain unprotected against MITM/downgrades." });
  }

  if (preload) {
    score += 25;
    findings.push({ severity: 'good', message: "'preload' directive is present. Domain is tagged for browser vendor preload lists." });
  } else {
    findings.push({ severity: 'low', message: "Missing 'preload' flag. Cannot be submitted to hstspreload.org." });
  }

  score = Math.min(100, score);

  /** @type {HstsAuditResult['status']} */
  let status = 'MISSING';
  if (isPreloadEligible) status = 'PRELOAD_READY';
  else if (score >= 60) status = 'ENFORCED';
  else if (score > 0) status = 'WEAK';

  return {
    raw,
    present: true,
    maxAge,
    maxAgeDays,
    includeSubDomains,
    preload,
    isPreloadEligible,
    score,
    status,
    findings
  };
}

/**
 * Parse and evaluate Permissions-Policy header.
 * @param {string|null|undefined} ppHeader
 * @returns {PermissionsPolicyResult}
 */
export function evaluatePermissionsPolicy(ppHeader) {
  const raw = (ppHeader || '').trim();
  /** @type {PermissionsPolicyResult['findings']} */
  const findings = [];
  /** @type {Record<string, string[]>} */
  const features = {};

  if (!raw) {
    findings.push({
      severity: 'medium',
      message: 'No Permissions-Policy header detected. Browser hardware APIs (Camera, Mic, Geolocation) default to origin policies.'
    });
    return {
      raw: '',
      present: false,
      features: {},
      restrictedCount: 0,
      score: 20,
      status: 'MISSING',
      findings
    };
  }

  const tokens = raw.split(',').map(t => t.trim()).filter(Boolean);
  let restrictedCount = 0;

  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx === -1) continue;
    const feat = token.slice(0, eqIdx).trim().toLowerCase();
    const val = token.slice(eqIdx + 1).trim();
    const origins = val.replace(/[()]/g, '').split(/\s+/).filter(Boolean);
    features[feat] = origins;
    if (val === '()' || origins.length === 0) {
      restrictedCount++;
    }
  }

  const highRiskFeatures = ['camera', 'microphone', 'geolocation', 'payment', 'usb'];
  const restrictedHighRisk = highRiskFeatures.filter(f => features[f] && features[f].length === 0);

  let score = 40 + (restrictedCount * 12);
  score = Math.min(100, Math.max(0, score));

  if (restrictedHighRisk.length >= 3) {
    findings.push({
      severity: 'good',
      message: `Strictly disabled ${restrictedHighRisk.length} sensitive hardware APIs: ${restrictedHighRisk.join(', ')}.`
    });
  } else {
    findings.push({
      severity: 'medium',
      message: 'Consider explicitly locking down unused hardware APIs (camera=(), microphone=(), geolocation=()).'
    });
  }

  /** @type {PermissionsPolicyResult['status']} */
  let status = 'PERMISSIVE';
  if (score >= 80) status = 'HARDENED';
  else if (score >= 50) status = 'PARTIAL';

  return {
    raw,
    present: true,
    features,
    restrictedCount,
    score,
    status,
    findings
  };
}

/**
 * Parse and audit Set-Cookie headers for security hygiene.
 * @param {string|string[]|null|undefined} cookieData
 * @returns {CookieAuditResult}
 */
export function auditCookies(cookieData) {
  /** @type {string[]} */
  let rawCookies = [];
  if (Array.isArray(cookieData)) {
    rawCookies = cookieData;
  } else if (typeof cookieData === 'string' && cookieData.trim()) {
    rawCookies = cookieData.split(/\r?\n/).filter(Boolean);
  }

  if (rawCookies.length === 0) {
    return {
      total: 0,
      cookies: [],
      allSecure: true,
      allHttpOnly: true,
      allSameSite: true,
      score: 100,
      status: 'NO_COOKIES',
      findings: [{ severity: 'good', message: 'No cookies set in response headers (Stateless & privacy-safe).' }]
    };
  }

  /** @type {AuditedCookie[]} */
  const cookies = [];
  /** @type {CookieAuditResult['findings']} */
  const findings = [];

  for (const cStr of rawCookies) {
    const parts = cStr.split(';').map(p => p.trim());
    if (!parts.length) continue;
    const kv = parts[0].split('=');
    const name = kv[0].trim();
    const val = kv.slice(1).join('=').trim();
    const valueMasked = val.length > 8 ? `${val.slice(0, 4)}…${val.slice(-3)}` : val;

    const lowerParts = parts.slice(1).map(p => p.toLowerCase());
    const isSecure = lowerParts.some(p => p === 'secure');
    const isHttpOnly = lowerParts.some(p => p === 'httponly');

    /** @type {'Strict' | 'Lax' | 'None' | 'Missing'} */
    let sameSite = 'Missing';
    const sameSitePart = lowerParts.find(p => p.startsWith('samesite='));
    if (sameSitePart) {
      const ssVal = sameSitePart.split('=')[1]?.trim();
      if (ssVal === 'strict') sameSite = 'Strict';
      else if (ssVal === 'lax') sameSite = 'Lax';
      else if (ssVal === 'none') sameSite = 'None';
    }

    const isPrefixSecure = name.startsWith('__Secure-') || name.startsWith('__Host-');
    /** @type {string[]} */
    const cookieFindings = [];

    if (!isSecure) {
      cookieFindings.push('Missing Secure flag (Sent over cleartext HTTP)');
    }
    if (!isHttpOnly) {
      cookieFindings.push('Missing HttpOnly flag (Accessible to document.cookie in XSS)');
    }
    if (sameSite === 'Missing') {
      cookieFindings.push('Missing SameSite attribute (Risk of CSRF)');
    } else if (sameSite === 'None' && !isSecure) {
      cookieFindings.push('SameSite=None without Secure flag (Rejected by modern browsers)');
    }

    cookies.push({
      name,
      valueMasked,
      isSecure,
      isHttpOnly,
      sameSite,
      isPrefixSecure,
      findings: cookieFindings
    });
  }

  const allSecure = cookies.every(c => c.isSecure);
  const allHttpOnly = cookies.every(c => c.isHttpOnly);
  const allSameSite = cookies.every(c => c.sameSite !== 'Missing');

  let score = 100;
  if (!allSecure) {
    score -= 35;
    findings.push({ severity: 'high', message: 'One or more cookies lack the Secure flag.' });
  }
  if (!allHttpOnly) {
    score -= 30;
    findings.push({ severity: 'high', message: 'One or more cookies lack the HttpOnly flag, exposing them to XSS attacks.' });
  }
  if (!allSameSite) {
    score -= 20;
    findings.push({ severity: 'medium', message: 'One or more cookies lack SameSite attributes, increasing CSRF vulnerability.' });
  }

  if (allSecure && allHttpOnly && allSameSite) {
    findings.push({ severity: 'good', message: 'All response cookies adhere to modern security hygiene (Secure, HttpOnly, SameSite).' });
  }

  score = Math.max(0, score);
  /** @type {CookieAuditResult['status']} */
  let status = 'RISK';
  if (score >= 85) status = 'HARDENED';
  else if (score >= 55) status = 'FAIR';

  return {
    total: cookies.length,
    cookies,
    allSecure,
    allHttpOnly,
    allSameSite,
    score,
    status,
    findings
  };
}

/**
 * Non-intrusive probe for accidental exposure of sensitive files & configuration leaks.
 * @param {string} domain
 * @param {{ fetcher?: (url: string) => Promise<{ contents: string, status?: number } | null> }} [options]
 * @returns {Promise<SensitiveLeaksResult>}
 */
export async function checkSensitiveLeaks(domain, options = {}) {
  /** @type {Array<{ path: string, title: string, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM', validator: (body: string, status: number) => boolean }>} */
  const targetProbes = [
    {
      path: '/.env',
      title: 'Environment Secret File (.env)',
      severity: 'CRITICAL',
      validator: (body, status) => {
        if (status !== 200 || !body) return false;
        if (/<(!doctype|html|head|body)/i.test(body)) return false;
        return /(APP_|DB_|SECRET|KEY|PASSWORD|TOKEN|API_)=/i.test(body);
      }
    },
    {
      path: '/.git/HEAD',
      title: 'Exposed Git Repository (.git/HEAD)',
      severity: 'CRITICAL',
      validator: (body, status) => {
        if (status !== 200 || !body) return false;
        return body.trim().startsWith('ref: refs/') || /^[0-9a-f]{40}$/i.test(body.trim());
      }
    },
    {
      path: '/wp-config.php.bak',
      title: 'Database Config Backup (wp-config.php.bak)',
      severity: 'CRITICAL',
      validator: (body, status) => {
        if (status !== 200 || !body) return false;
        if (/<(!doctype|html|head|body)/i.test(body)) return false;
        return /(DB_NAME|DB_PASSWORD|DB_USER|\$table_prefix)/i.test(body);
      }
    },
    {
      path: '/server-status',
      title: 'Apache Status Page (/server-status)',
      severity: 'MEDIUM',
      validator: (body, status) => {
        if (status !== 200 || !body) return false;
        return /Apache Server Status for/i.test(body) && /Server Version:/i.test(body);
      }
    },
    {
      path: '/swagger.json',
      title: 'Exposed Swagger/OpenAPI Spec (/swagger.json)',
      severity: 'MEDIUM',
      validator: (body, status) => {
        if (status !== 200 || !body) return false;
        return /"swagger":|"openapi":/i.test(body);
      }
    }
  ];

  const fetchFn = options.fetcher || (url => fetchViaCorsProxy(url, { timeout: 2500 }));

  const probePromises = targetProbes.map(async probe => {
    try {
      const probeUrl = `https://${domain}${probe.path}`;
      const res = await fetchFn(probeUrl);
      if (!res || !res.contents) {
        return {
          path: probe.path,
          title: probe.title,
          severity: probe.severity,
          status: /** @type {'CLEAN'} */ ('CLEAN'),
          evidence: null
        };
      }

      const isExposed = probe.validator(res.contents, 200);
      if (isExposed) {
        return {
          path: probe.path,
          title: probe.title,
          severity: probe.severity,
          status: /** @type {'EXPOSED'} */ ('EXPOSED'),
          evidence: `Signature match confirmed on ${probe.path}`
        };
      }
      return {
        path: probe.path,
        title: probe.title,
        severity: probe.severity,
        status: /** @type {'CLEAN'} */ ('CLEAN'),
        evidence: null
      };
    } catch {
      return {
        path: probe.path,
        title: probe.title,
        severity: probe.severity,
        status: /** @type {'CLEAN'} */ ('CLEAN'),
        evidence: null
      };
    }
  });

  const results = await Promise.all(probePromises);
  const exposedCount = results.filter(r => r.status === 'EXPOSED').length;
  const cleanCount = results.filter(r => r.status === 'CLEAN').length;
  const hasCriticalExposure = results.some(r => r.status === 'EXPOSED' && r.severity === 'CRITICAL');
  let score = 100 - (exposedCount * 35);
  score = Math.max(0, Math.min(100, score));

  return {
    probes: results,
    exposedCount,
    cleanCount,
    score,
    hasCriticalExposure
  };
}

/**
 * Generate 1-click copy-paste hardened security header snippets.
 * @param {string} domain
 * @returns {ServerSnippets}
 */
export function generateHardenedSnippets(domain = 'example.com') {
  const host = domain || 'example.com';

  const nginx = `# ─── Nginx Hardened Security Headers ───
server {
    server_name ${host};

    # Strict-Transport-Security (2-year HSTS + Preload)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Content-Security-Policy (Restricted Execution AST)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;

    # Fundamental Security Directives
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
}`;

  const apache = `# ─── Apache Hardened Security Headers (.htaccess) ───
<IfModule mod_headers.c>
    # Strict-Transport-Security (2-year HSTS + Preload)
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

    # Content-Security-Policy (Restricted Execution AST)
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"

    # Fundamental Security Directives
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()"
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Resource-Policy "same-origin"
</IfModule>`;

  const vercel = `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" }
      ]
    }
  ]
}`;

  const caddy = `# ─── Caddyfile Hardened Headers ───
${host} {
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Resource-Policy "same-origin"
    }
}`;

  return { nginx, apache, vercel, caddy };
}

/**
 * Perform complete Deep Security & Infrastructure Hardening audit.
 * @param {string} domain
 * @param {Record<string, string>} [headers={}]
 * @param {string} [_html='']
 * @param {string} [baseUrl='']
 * @param {{ skipProbes?: boolean, fetcher?: (url: string) => Promise<{ contents: string, status?: number } | null> }} [options={}]
 * @returns {Promise<DeepSecurityResult>}
 */
export async function auditDeepSecurity(domain, headers = {}, _html = '', baseUrl = '', options = {}) {
  const normHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    normHeaders[k.toLowerCase()] = v;
  }

  // 1. Content Security Policy
  const cspHeader = normHeaders['content-security-policy'] || normHeaders['content-security-policy-report-only'] || '';
  const csp = parseAndEvaluateCsp(cspHeader);

  // 2. HSTS & Preload
  const hstsHeader = normHeaders['strict-transport-security'] || '';
  const isHttps = baseUrl.startsWith('https://') || !baseUrl.startsWith('http://');
  const hsts = evaluateHsts(hstsHeader, isHttps);

  // 3. Permissions Policy
  const ppHeader = normHeaders['permissions-policy'] || normHeaders['feature-policy'] || '';
  const permissionsPolicy = evaluatePermissionsPolicy(ppHeader);

  // 4. Cookies
  const cookieHeader = normHeaders['set-cookie'] || '';
  const cookies = auditCookies(cookieHeader);

  // 5. Sensitive Leaks Probe
  /** @type {SensitiveLeaksResult} */
  let sensitiveLeaks = {
    probes: [],
    exposedCount: 0,
    cleanCount: 0,
    score: 100,
    hasCriticalExposure: false
  };

  if (!options.skipProbes) {
    try {
      sensitiveLeaks = await checkSensitiveLeaks(domain, options);
    } catch (err) {
      logWarn('deepSecurity:checkSensitiveLeaks', err);
    }
  }

  // 6. Fundamental Headers
  const fundamentalHeaders = {
    xContentTypeOptions: (normHeaders['x-content-type-options'] || '').toLowerCase().includes('nosniff'),
    xFrameOptions: normHeaders['x-frame-options'] || null,
    referrerPolicy: normHeaders['referrer-policy'] || null,
    crossOriginOpenerPolicy: normHeaders['cross-origin-opener-policy'] || null
  };

  let fundamentalScore = 0;
  if (fundamentalHeaders.xContentTypeOptions) fundamentalScore += 35;
  if (fundamentalHeaders.xFrameOptions) fundamentalScore += 35;
  if (fundamentalHeaders.referrerPolicy) fundamentalScore += 30;

  // 7. Weighted Composite Score: CSP 30%, HSTS 25%, Fundamental 20%, Cookies 15%, Leaks 10%
  let overallScore = Math.round(
    (csp.score * 0.30) +
    (hsts.score * 0.25) +
    (fundamentalScore * 0.20) +
    (cookies.score * 0.15) +
    (sensitiveLeaks.score * 0.10)
  );

  if (sensitiveLeaks.hasCriticalExposure) {
    overallScore = Math.min(30, overallScore);
  }

  overallScore = Math.max(0, Math.min(100, overallScore));

  /** @type {DeepSecurityResult['grade']} */
  let grade = 'F';
  if (overallScore >= 95) grade = 'A+';
  else if (overallScore >= 85) grade = 'A';
  else if (overallScore >= 70) grade = 'B';
  else if (overallScore >= 55) grade = 'C';
  else if (overallScore >= 40) grade = 'D';

  /** @type {DeepSecurityResult['actionableFixes']} */
  const actionableFixes = [];

  if (sensitiveLeaks.hasCriticalExposure) {
    actionableFixes.push({
      severity: 'critical',
      title: 'Block Public Access to Exposed Sensitive Files',
      hint: 'Configure web server or reverse proxy to return 404/403 for dotfiles (e.g. .env, .git) immediately.'
    });
  }

  if (!csp.raw || csp.score < 50) {
    actionableFixes.push({
      severity: 'high',
      title: 'Enforce a Hardened Content-Security-Policy (CSP)',
      hint: "Define 'default-src 'self'' and 'object-src 'none'', and remove un-hashed 'unsafe-inline' script directives."
    });
  }

  if (!hsts.isPreloadEligible) {
    actionableFixes.push({
      severity: 'medium',
      title: 'Upgrade HSTS for Preload Eligibility',
      hint: "Set max-age to 63072000 (2 years), add 'includeSubDomains', and include the 'preload' flag."
    });
  }

  if (!fundamentalHeaders.xContentTypeOptions) {
    actionableFixes.push({
      severity: 'medium',
      title: 'Set X-Content-Type-Options: nosniff',
      hint: 'Prevents MIME-type confusion attacks and executable polyglot uploads.'
    });
  }

  if (!cookies.allSecure || !cookies.allHttpOnly) {
    actionableFixes.push({
      severity: 'medium',
      title: 'Harden Session Cookies with Secure & HttpOnly',
      hint: 'Ensure all authentication and tracking cookies include Secure, HttpOnly, and SameSite=Lax/Strict.'
    });
  }

  const snippets = generateHardenedSnippets(domain);

  return {
    domain,
    overallScore,
    grade,
    csp,
    hsts,
    permissionsPolicy,
    cookies,
    sensitiveLeaks,
    fundamentalHeaders,
    snippets,
    actionableFixes
  };
}

/**
 * Render the Deep Security & Infrastructure Hardening panel into DOM.
 * @param {DeepSecurityResult} data
 * @param {string} domain
 * @param {HTMLElement|null} containerEl
 */
export function renderDeepSecurityPanel(data, domain, containerEl) {
  if (!containerEl) return;

  const gradeColor =
    data.grade === 'A+' || data.grade === 'A' ? 'var(--green)' :
    data.grade === 'B' ? 'var(--cyan)' :
    data.grade === 'C' ? 'var(--yellow)' : 'var(--red)';

  const cspStatusColor =
    data.csp.status === 'EXCELLENT' || data.csp.status === 'GOOD' ? 'var(--green)' :
    data.csp.status === 'NEEDS_IMPROVEMENT' ? 'var(--yellow)' : 'var(--red)';

  const hstsStatusColor =
    data.hsts.status === 'PRELOAD_READY' || data.hsts.status === 'ENFORCED' ? 'var(--green)' :
    data.hsts.status === 'WEAK' ? 'var(--yellow)' : 'var(--red)';

  const cookieStatusColor =
    data.cookies.status === 'HARDENED' || data.cookies.status === 'NO_COOKIES' ? 'var(--green)' :
    data.cookies.status === 'FAIR' ? 'var(--yellow)' : 'var(--red)';

  const leakStatusColor =
    data.sensitiveLeaks.exposedCount === 0 ? 'var(--green)' : 'var(--red)';

  const directiveTags = Object.keys(data.csp.directives).map(dir => {
    return `<span style="display:inline-block;padding:2px 7px;font-size:0.68rem;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:4px;font-family:monospace;margin:2px;">${escapeHtml(dir)}</span>`;
  }).join('') || '<span style="color:var(--text-dim);font-size:0.75rem;">None</span>';

  const preloadHtml = `
    <div style="display:flex;flex-direction:column;gap:5px;font-size:0.75rem;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span>${data.hsts.maxAge >= 31536000 ? '✅' : '❌'}</span>
        <span>max-age &ge; 1 year (${data.hsts.maxAgeDays} days)</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span>${data.hsts.includeSubDomains ? '✅' : '❌'}</span>
        <span>includeSubDomains directive</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span>${data.hsts.preload ? '✅' : '❌'}</span>
        <span>preload flag enabled</span>
      </div>
    </div>
  `;

  const probesHtml = data.sensitiveLeaks.probes.map(p => {
    const isClean = p.status === 'CLEAN';
    const badgeColor = isClean ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.2)';
    const textColor = isClean ? '#86efac' : '#fca5a5';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;font-size:0.72rem;">
        <span style="font-family:monospace;">${escapeHtml(p.path)}</span>
        <span style="padding:2px 8px;border-radius:4px;background:${badgeColor};color:${textColor};font-weight:700;">
          ${isClean ? 'PROTECTED' : '⚠️ EXPOSED'}
        </span>
      </div>
    `;
  }).join('') || '<div style="font-size:0.72rem;color:var(--text-dim);">No probes executed.</div>';

  const fixesHtml = data.actionableFixes.map(f => {
    const icon = f.severity === 'critical' ? '🚨' : f.severity === 'high' ? '⚠️' : '💡';
    return `
      <div style="padding:10px 12px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:8px;">
        <div style="font-size:0.8rem;font-weight:600;margin-bottom:3px;display:flex;align-items:center;gap:6px;">
          <span>${icon}</span>
          <span>${escapeHtml(f.title)}</span>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${escapeHtml(f.hint)}</div>
      </div>
    `;
  }).join('') || '<div style="font-size:0.78rem;color:var(--green);padding:6px;">✨ No critical security vulnerabilities discovered!</div>';

  containerEl.innerHTML = `
    <!-- Top Hero Score Bar -->
    <div style="padding:18px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:130px 1fr;gap:20px;align-items:center;">
      <div style="text-align:center;">
        <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Security Grade</div>
        <div style="font-size:3.2rem;font-weight:800;font-family:'Space Grotesk',sans-serif;line-height:1;color:${gradeColor};text-shadow:0 0 24px ${gradeColor}40;">
          ${data.grade}
        </div>
        <div style="margin-top:6px;font-size:0.72rem;font-weight:700;color:var(--text);">${data.overallScore}/100 Score</div>
      </div>
      <div>
        <div style="font-size:0.88rem;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
          <span>Deep Security &amp; Infrastructure Hardening (Phase 1)</span>
          <span style="font-size:0.65rem;padding:2px 8px;border-radius:12px;background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.4);">RFC 6797 &middot; AST CSP</span>
        </div>
        <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.45;margin-bottom:10px;">
          Comprehensive AST Content Security Policy evaluation, RFC 6797 HSTS Preload readiness verification, cookie attribute hygiene, sensitive file leak detection, and 1-click server snippets.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.7rem;">
          <span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid var(--border);">
            CSP: <strong style="color:${cspStatusColor};">${data.csp.status}</strong>
          </span>
          <span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid var(--border);">
            HSTS: <strong style="color:${hstsStatusColor};">${data.hsts.status}</strong>
          </span>
          <span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid var(--border);">
            Cookies: <strong style="color:${cookieStatusColor};">${data.cookies.status}</strong>
          </span>
          <span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid var(--border);">
            Leaks: <strong style="color:${leakStatusColor};">${data.sensitiveLeaks.exposedCount === 0 ? 'CLEAN' : 'ALERT'}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- 4-Card Diagnostics Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;padding:16px;border-bottom:1px solid var(--border);">
      
      <!-- Card 1: CSP AST Analysis -->
      <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>Content Security Policy (AST)</span>
          <span style="color:${cspStatusColor};">${data.csp.score}/100</span>
        </div>
        <div style="font-size:0.75rem;margin-bottom:8px;color:var(--text);">
          Directives (${data.csp.directiveCount}):
        </div>
        <div style="margin-bottom:10px;line-height:1.6;">
          ${directiveTags}
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);display:flex;flex-direction:column;gap:3px;">
          <div>${data.csp.unsafeInline ? '❌ Allows unsafe-inline scripts' : '✅ No unsafe-inline in scripts'}</div>
          <div>${data.csp.objectSrcNone ? '✅ object-src locked to \'none\'' : '⚠️ Missing object-src \'none\''}</div>
          <div>${data.csp.baseUriRestricted ? '✅ base-uri constrained' : '⚠️ Missing base-uri restriction'}</div>
        </div>
      </div>

      <!-- Card 2: HSTS Preload Compliance -->
      <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>HSTS Preload Verification</span>
          <span style="color:${hstsStatusColor};">${data.hsts.isPreloadEligible ? 'READY' : 'INCOMPLETE'}</span>
        </div>
        ${preloadHtml}
        <div style="margin-top:12px;font-size:0.68rem;">
          <a href="https://hstspreload.org/?domain=${encodeURIComponent(domain)}" target="_blank" rel="noopener" style="color:var(--violet-2);text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            Check live submission on hstspreload.org &rarr;
          </a>
        </div>
      </div>

      <!-- Card 3: Cookie Hygiene -->
      <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>Cookie &amp; Storage Hygiene</span>
          <span style="color:${cookieStatusColor};">${data.cookies.total} Tracked</span>
        </div>
        <div style="font-size:0.74rem;display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">Secure Flag:</span>
            <span>${data.cookies.allSecure ? '✅ Enforced' : '❌ Insecure'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">HttpOnly Flag:</span>
            <span>${data.cookies.allHttpOnly ? '✅ Enforced' : '❌ Missing'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);">SameSite Attribute:</span>
            <span>${data.cookies.allSameSite ? '✅ Configured' : '⚠️ Missing'}</span>
          </div>
        </div>
      </div>

      <!-- Card 4: Information Leaks & Sensitive Endpoints -->
      <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>Sensitive Files &amp; Leaks</span>
          <span style="color:${leakStatusColor};">${data.sensitiveLeaks.exposedCount === 0 ? '0 Exposed' : `${data.sensitiveLeaks.exposedCount} LEAKS`}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${probesHtml}
        </div>
      </div>

    </div>

    <!-- 1-Click Hardened Server Snippets Generator -->
    <div style="padding:16px;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
          <span>⚡ 1-Click Hardened Server Snippet Generator</span>
        </div>
        <div style="display:flex;gap:6px;" id="secSnippetTabs">
          <button class="tab-btn active" data-server="nginx" style="padding:3px 10px;font-size:0.7rem;">Nginx</button>
          <button class="tab-btn" data-server="apache" style="padding:3px 10px;font-size:0.7rem;">Apache</button>
          <button class="tab-btn" data-server="vercel" style="padding:3px 10px;font-size:0.7rem;">Vercel</button>
          <button class="tab-btn" data-server="caddy" style="padding:3px 10px;font-size:0.7rem;">Caddy</button>
        </div>
      </div>
      <div style="position:relative;">
        <pre id="secSnippetCode" style="margin:0;padding:12px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:8px;font-family:monospace;font-size:0.72rem;color:#c4b5fd;overflow-x:auto;line-height:1.45;max-height:220px;">${escapeHtml(data.snippets.nginx)}</pre>
        <button id="copySecSnippetBtn" style="position:absolute;top:8px;right:8px;padding:4px 10px;font-size:0.68rem;background:var(--violet);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">
          Copy Config
        </button>
      </div>
    </div>

    <!-- Remediation Action Plan -->
    <div style="padding:16px;">
      <div style="font-size:0.78rem;font-weight:700;margin-bottom:10px;color:var(--text);">
        🛠️ Recommended Remediation Action Items
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${fixesHtml}
      </div>
    </div>
  `;

  // Attach Snippet Tabs & Copy Listener
  const snippetButtons = containerEl.querySelectorAll('#secSnippetTabs button');
  const codeEl = containerEl.querySelector('#secSnippetCode');
  const copyBtn = containerEl.querySelector('#copySecSnippetBtn');

  snippetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      snippetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const server = btn.getAttribute('data-server');
      if (codeEl && server && data.snippets[server]) {
        codeEl.textContent = data.snippets[server];
      }
    });
  });

  if (copyBtn && codeEl) {
    copyBtn.addEventListener('click', () => {
      const text = codeEl.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied! ✓';
        setTimeout(() => { copyBtn.textContent = orig; }, 2000);
      }).catch(() => {
        copyBtn.textContent = 'Copied!';
      });
    });
  }
}
