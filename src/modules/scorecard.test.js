import { describe, it, expect } from 'vitest';
import { calculateSecurityScorecard } from './scorecard.js';

describe('calculateSecurityScorecard', () => {
  it('assigns A+ for HTTPS site with full security headers & clean scan', () => {
    const result = calculateSecurityScorecard({
      url: 'https://example.com',
      securityScan: { level: 'safe', score: 0, findings: [], dbStatus: 'clean' },
      headers: {
        'strict-transport-security': 'max-age=63072000',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin'
      },
      sslInfo: { valid: true, daysRemaining: 120 }
    });

    expect(result.grade).toBe('A+');
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.remediations.length).toBe(0);
    expect(result.strengths.length).toBeGreaterThan(2);
  });

  it('deducts points for missing HTTP security headers and yields appropriate grade', () => {
    const result = calculateSecurityScorecard({
      url: 'https://example.com',
      securityScan: { level: 'safe', score: 0, findings: [], dbStatus: 'clean' },
      headers: {} // missing headers
    });

    expect(result.score).toBeLessThan(100);
    expect(result.remediations.some(r => r.id === 'hsts-missing')).toBe(true);
    expect(result.remediations.some(r => r.id === 'csp-missing')).toBe(true);
  });

  it('assigns F grade and critical remediations for HTTP + critical threat', () => {
    const result = calculateSecurityScorecard({
      url: 'http://malicious-site.tk',
      securityScan: {
        level: 'critical',
        score: 80,
        findings: [{ type: 'danger', text: 'Domain "g00gle" uses character substitution (homoglyphs)' }],
        dbStatus: 'blacklisted'
      }
    });

    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThan(40);
    expect(result.remediations.some(r => r.id === 'https-missing')).toBe(true);
    expect(result.remediations.some(r => r.id === 'threat-critical')).toBe(true);
  });

  it('penalizes expiring SSL certificate', () => {
    const result = calculateSecurityScorecard({
      url: 'https://expiring-ssl.com',
      sslInfo: { valid: true, daysRemaining: 5 }
    });

    expect(result.remediations.some(r => r.id === 'ssl-expiring-soon')).toBe(true);
  });
});
