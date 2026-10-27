import { describe, it, expect } from 'vitest';
import { heuristicScan, isPrivateIP, THREAT_META } from './security.js';

describe('isPrivateIP', () => {
  it('detects 127.0.0.1 as loopback', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
  });

  it('detects 10.x.x.x as private', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
  });

  it('detects 192.168.x.x as private', () => {
    expect(isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('detects 172.16.x.x as private', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
  });

  it('detects IPv6 loopback and link-local as private', () => {
    expect(isPrivateIP('::1')).toBe(true);
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
  });

  it('detects CGNAT and benchmark ranges as private', () => {
    expect(isPrivateIP('100.64.0.1')).toBe(true);
    expect(isPrivateIP('198.18.0.1')).toBe(true);
  });

  it('returns false for public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });
});

describe('heuristicScan', () => {
  it('scores https sites lower (safer)', () => {
    const https = heuristicScan('https://google.com');
    const http = heuristicScan('http://google.com');
    expect(https.score).toBeLessThan(http.score);
  });

  it('detects raw IP addresses as suspicious', () => {
    const result = heuristicScan('http://192.168.1.1/admin');
    expect(result.findings.some((f) => f.type === 'danger')).toBe(true);
    expect(result.score).toBeGreaterThan(30);
  });

  it('detects suspicious TLDs', () => {
    const result = heuristicScan('https://login-bank.xyz/verify');
    expect(result.findings.some((f) => f.text.includes('.xyz'))).toBe(true);
  });

  it('detects typosquatting', () => {
    const result = heuristicScan('https://www.gooogle.com');
    expect(result.findings.some((f) => f.type === 'danger' && f.text.includes('gooogle'))).toBe(true);
  });

  it('detects phishing keywords', () => {
    const result = heuristicScan('https://secure-login-verify.com/account/update');
    expect(result.findings.some((f) => f.text.toLowerCase().includes('phishing'))).toBe(true);
  });

  it('returns safe for clean URLs', () => {
    const result = heuristicScan('https://github.com');
    expect(result.level).toBe('safe');
    expect(result.score).toBeLessThanOrEqual(15);
  });

  it('detects known brand', () => {
    const result = heuristicScan('https://github.com');
    expect(result.findings.some((f) => f.text.includes('known brand'))).toBe(true);
  });

  it('handles data URIs', () => {
    const result = heuristicScan('data:text/html,<script>alert(1)</script>');
    expect(result.level).toBe('high');
  });
});

describe('THREAT_META', () => {
  it('has metadata for all threat levels', () => {
    const levels = ['safe', 'low', 'medium', 'high', 'critical'];
    levels.forEach((l) => {
      expect(THREAT_META[l]).toBeDefined();
      expect(THREAT_META[l]).toHaveProperty('label');
      expect(THREAT_META[l]).toHaveProperty('icon');
      expect(THREAT_META[l]).toHaveProperty('secCls');
    });
  });
});
