import { describe, it, expect } from 'vitest';
import { isValidEmailFormat, emailScamScore, getVerdict, EMAIL_VERDICT } from './email.js';

describe('isValidEmailFormat', () => {
  it('validates correct email addresses', () => {
    expect(isValidEmailFormat('user@gmail.com')).toBe(true);
    expect(isValidEmailFormat('test.name@example.co.uk')).toBe(true);
    expect(isValidEmailFormat('user+tag@example.com')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmailFormat('not-an-email')).toBe(false);
    expect(isValidEmailFormat('@example.com')).toBe(false);
    expect(isValidEmailFormat('user@')).toBe(false);
    expect(isValidEmailFormat('')).toBe(false);
  });
});

describe('emailScamScore', () => {
  it('scores legitimate providers lower', () => {
    const result = emailScamScore('john.doe', 'gmail.com');
    expect(result.score).toBeLessThan(20);
    expect(result.findings.some((f) => f.type === 'good')).toBe(true);
  });

  it('detects suspicious TLDs', () => {
    const result = emailScamScore('admin', 'secure-login.xyz');
    expect(result.score).toBeGreaterThan(20);
  });

  it('detects scam keywords in local part', () => {
    const result = emailScamScore('prize-winner-claim', 'example.com');
    expect(result.score).toBeGreaterThan(15);
  });

  it('detects brand impersonation via typo', () => {
    const result = emailScamScore('support', 'paypa1.com');
    expect(result.findings.some((f) => f.type === 'danger')).toBe(true);
  });

  it('detects brand name in domain', () => {
    const result = emailScamScore('billing', 'paypal-secure-verify.com');
    expect(result.findings.some((f) => f.type === 'danger')).toBe(true);
  });

  it('flags entirely numeric domains', () => {
    const result = emailScamScore('user', '123456.com');
    expect(result.score).toBeGreaterThan(10);
  });
});

describe('getVerdict', () => {
  it('returns invalid for bad format', () => {
    expect(getVerdict(0, false, false)).toBe('invalid');
  });

  it('returns disposable for known disposable domains', () => {
    expect(getVerdict(0, true, true)).toBe('disposable');
  });

  it('returns clean for low scores', () => {
    expect(getVerdict(5, false, true)).toBe('clean');
  });

  it('returns critical for high scores', () => {
    expect(getVerdict(85, false, true)).toBe('critical');
  });
});

describe('EMAIL_VERDICT', () => {
  it('has all required verdicts', () => {
    const keys = ['clean', 'low', 'medium', 'high', 'critical', 'invalid', 'disposable'];
    keys.forEach((k) => {
      expect(EMAIL_VERDICT[k]).toBeDefined();
      expect(EMAIL_VERDICT[k]).toHaveProperty('label');
      expect(EMAIL_VERDICT[k]).toHaveProperty('icon');
    });
  });
});
