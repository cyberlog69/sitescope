import { describe, it, expect } from 'vitest';
import { compareSites } from './comparison.js';

describe('comparison module', () => {
  it('correctly calculates metric winners and overall winner when siteA is stronger', () => {
    const siteA = {
      url: 'https://sitea.com',
      domain: 'sitea.com',
      scorecard: { score: 95, grade: 'A+' },
      security: { score: 0, level: 'safe' },
      sslInfo: { valid: true, daysRemaining: 180 },
      latencyMs: 45,
      techCount: 8
    };

    const siteB = {
      url: 'http://siteb.com',
      domain: 'siteb.com',
      scorecard: { score: 50, grade: 'D' },
      security: { score: 40, level: 'high' },
      sslInfo: { valid: false, daysRemaining: 0 },
      latencyMs: 320,
      techCount: 2
    };

    const result = compareSites(siteA, siteB);
    expect(result.overallWinner).toBe('A');
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
    expect(result.comparisons.find(c => c.metric === 'scorecard')?.winner).toBe('A');
    expect(result.comparisons.find(c => c.metric === 'https')?.winner).toBe('A');
    expect(result.comparisons.find(c => c.metric === 'latency')?.winner).toBe('A');
  });

  it('correctly calculates TIE when both sites have identical metrics', () => {
    const siteA = {
      url: 'https://example.com',
      domain: 'example.com',
      scorecard: { score: 85, grade: 'A' },
      security: { score: 0, level: 'safe' },
      sslInfo: { valid: true, daysRemaining: 90 },
      latencyMs: 100,
      techCount: 5
    };

    const siteB = {
      url: 'https://example.com',
      domain: 'example.com',
      scorecard: { score: 85, grade: 'A' },
      security: { score: 0, level: 'safe' },
      sslInfo: { valid: true, daysRemaining: 90 },
      latencyMs: 100,
      techCount: 5
    };

    const result = compareSites(siteA, siteB);
    expect(result.overallWinner).toBe('TIE');
    expect(result.scoreA).toBe(result.scoreB);
  });
});
