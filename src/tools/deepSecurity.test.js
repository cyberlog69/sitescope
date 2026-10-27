import { describe, it, expect } from 'vitest';
import {
  parseAndEvaluateCsp,
  evaluateHsts,
  evaluatePermissionsPolicy,
  auditCookies,
  generateHardenedSnippets,
  auditDeepSecurity,
  checkSensitiveLeaks
} from './deepSecurity.js';

describe('deepSecurity: parseAndEvaluateCsp', () => {
  it('handles missing or empty CSP header', () => {
    const res = parseAndEvaluateCsp('');
    expect(res.status).toBe('MISSING');
    expect(res.score).toBe(0);
    expect(res.findings.length).toBeGreaterThan(0);
  });

  it('detects unsafe-inline and unsafe-eval in script-src', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';";
    const res = parseAndEvaluateCsp(csp);
    expect(res.unsafeInline).toBe(true);
    expect(res.unsafeEval).toBe(true);
    expect(res.score).toBeLessThan(70);
    expect(res.findings.some(f => f.message.includes('unsafe-inline'))).toBe(true);
  });

  it('validates a hardened, production-grade CSP', () => {
    const csp = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;";
    const res = parseAndEvaluateCsp(csp);
    expect(res.unsafeInline).toBe(false);
    expect(res.unsafeEval).toBe(false);
    expect(res.objectSrcNone).toBe(true);
    expect(res.baseUriRestricted).toBe(true);
    expect(res.upgradeInsecureRequests).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(90);
    expect(res.status).toBe('EXCELLENT');
  });

  it('detects wildcards in network directives', () => {
    const csp = "default-src 'self'; img-src *; connect-src http://api.com;";
    const res = parseAndEvaluateCsp(csp);
    expect(res.wildcardSources).toContain('img-src');
    expect(res.wildcardSources).toContain('connect-src');
  });
});

describe('deepSecurity: evaluateHsts', () => {
  it('handles missing HSTS header', () => {
    const res = evaluateHsts(null);
    expect(res.present).toBe(false);
    expect(res.isPreloadEligible).toBe(false);
    expect(res.status).toBe('MISSING');
  });

  it('identifies weak HSTS with low max-age', () => {
    const res = evaluateHsts('max-age=86400');
    expect(res.present).toBe(true);
    expect(res.maxAge).toBe(86400);
    expect(res.maxAgeDays).toBe(1);
    expect(res.isPreloadEligible).toBe(false);
    expect(res.status).toBe('WEAK');
  });

  it('verifies Chromium/Safari HSTS Preload readiness (RFC 6797)', () => {
    const res = evaluateHsts('max-age=63072000; includeSubDomains; preload', true);
    expect(res.present).toBe(true);
    expect(res.maxAgeDays).toBe(730);
    expect(res.includeSubDomains).toBe(true);
    expect(res.preload).toBe(true);
    expect(res.isPreloadEligible).toBe(true);
    expect(res.status).toBe('PRELOAD_READY');
  });
});

describe('deepSecurity: evaluatePermissionsPolicy', () => {
  it('handles missing Permissions-Policy', () => {
    const res = evaluatePermissionsPolicy('');
    expect(res.present).toBe(false);
    expect(res.status).toBe('MISSING');
  });

  it('parses and identifies hardened restrictions', () => {
    const pp = 'camera=(), microphone=(), geolocation=(), payment=()';
    const res = evaluatePermissionsPolicy(pp);
    expect(res.present).toBe(true);
    expect(res.restrictedCount).toBe(4);
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.status).toBe('HARDENED');
  });
});

describe('deepSecurity: auditCookies', () => {
  it('reports stateless pass when no cookies are set', () => {
    const res = auditCookies(null);
    expect(res.total).toBe(0);
    expect(res.allSecure).toBe(true);
    expect(res.status).toBe('NO_COOKIES');
  });

  it('identifies insecure cookies missing Secure and HttpOnly flags', () => {
    const raw = 'session_id=abc123456; Path=/';
    const res = auditCookies(raw);
    expect(res.total).toBe(1);
    expect(res.cookies[0].isSecure).toBe(false);
    expect(res.cookies[0].isHttpOnly).toBe(false);
    expect(res.cookies[0].sameSite).toBe('Missing');
    expect(res.score).toBeLessThan(50);
  });

  it('validates compliant, hardened cookies', () => {
    const raw = [
      '__Host-sess=secretValue123; Path=/; Secure; HttpOnly; SameSite=Strict',
      'theme=dark; Secure; SameSite=Lax'
    ];
    const res = auditCookies(raw);
    expect(res.total).toBe(2);
    expect(res.cookies[0].isPrefixSecure).toBe(true);
    expect(res.cookies[0].sameSite).toBe('Strict');
    expect(res.cookies[1].isSecure).toBe(true);
  });
});

describe('deepSecurity: checkSensitiveLeaks with mock fetcher', () => {
  it('detects exposed .env and clean responses accurately', async () => {
    const mockFetcher = async (url) => {
      if (url.endsWith('/.env')) {
        return { contents: 'APP_SECRET=supersecret123\nDB_PASSWORD=rootpass', status: 200 };
      }
      return { contents: '', status: 404 };
    };

    const res = await checkSensitiveLeaks('test-site.com', { fetcher: mockFetcher });
    expect(res.exposedCount).toBe(1);
    expect(res.hasCriticalExposure).toBe(true);
    expect(res.probes.find(p => p.path === '/.env')?.status).toBe('EXPOSED');
    expect(res.probes.find(p => p.path === '/.git/HEAD')?.status).toBe('CLEAN');
  });
});

describe('deepSecurity: generateHardenedSnippets', () => {
  it('generates Nginx, Apache, Vercel, and Caddy configurations', () => {
    const snippets = generateHardenedSnippets('security.test');
    expect(snippets.nginx).toContain('server_name security.test;');
    expect(snippets.nginx).toContain('Strict-Transport-Security');
    expect(snippets.apache).toContain('Header always set Strict-Transport-Security');
    expect(snippets.vercel).toContain('"key": "Content-Security-Policy"');
    expect(snippets.caddy).toContain('security.test {');
  });
});

describe('deepSecurity: auditDeepSecurity', () => {
  it('computes composite score and actionable fixes with skipProbes', async () => {
    const headers = {
      'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';",
      'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin'
    };

    const res = await auditDeepSecurity('example.com', headers, '', 'https://example.com', { skipProbes: true });
    expect(res.domain).toBe('example.com');
    expect(res.overallScore).toBeGreaterThanOrEqual(85);
    expect(['A+', 'A']).toContain(res.grade);
    expect(res.snippets.nginx).toBeDefined();
  });
});
