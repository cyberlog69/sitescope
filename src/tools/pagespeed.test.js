import { describe, it, expect } from 'vitest';
import { getMetricRating, formatScoreInt, parsePageSpeedResponse } from './pagespeed.js';

describe('pagespeed module', () => {
  describe('getMetricRating', () => {
    it('returns good for score >= 0.9', () => {
      expect(getMetricRating(0.95)).toBe('good');
      expect(getMetricRating(0.9)).toBe('good');
    });

    it('returns needs-improvement for score >= 0.5 and < 0.9', () => {
      expect(getMetricRating(0.89)).toBe('needs-improvement');
      expect(getMetricRating(0.5)).toBe('needs-improvement');
    });

    it('returns poor for score < 0.5', () => {
      expect(getMetricRating(0.49)).toBe('poor');
      expect(getMetricRating(0)).toBe('poor');
    });

    it('returns unknown for null or undefined', () => {
      expect(getMetricRating(null)).toBe('unknown');
      expect(getMetricRating(undefined)).toBe('unknown');
    });
  });

  describe('formatScoreInt', () => {
    it('converts 0-1 float score to 0-100 integer', () => {
      expect(formatScoreInt(0.88)).toBe(88);
      expect(formatScoreInt(1)).toBe(100);
      expect(formatScoreInt(0)).toBe(0);
    });

    it('returns null for non-numbers', () => {
      expect(formatScoreInt(null)).toBe(null);
      expect(formatScoreInt(undefined)).toBe(null);
    });
  });

  describe('parsePageSpeedResponse', () => {
    it('handles missing or malformed response gracefully', () => {
      const parsed = parsePageSpeedResponse(null);
      expect(parsed.scores.performance).toBeNull();
      expect(parsed.error).toBeDefined();
    });

    it('parses valid lighthouse result correctly', () => {
      const mockData = {
        lighthouseResult: {
          categories: {
            performance: { score: 0.92 },
            accessibility: { score: 0.85 },
            'best-practices': { score: 0.96 },
            seo: { score: 0.9 }
          },
          audits: {
            'largest-contentful-paint': { displayValue: '1.2 s', score: 0.95, numericValue: 1200 },
            'cumulative-layout-shift': { displayValue: '0.01', score: 0.98, numericValue: 0.01 },
            'unused-css-rules': {
              title: 'Reduce unused CSS',
              description: 'Save 45 KB [Learn more](https://web.dev)',
              displayValue: 'Potential savings of 45 KiB',
              score: 0.6,
              details: { type: 'opportunity' }
            }
          }
        }
      };

      const parsed = parsePageSpeedResponse(mockData);
      expect(parsed.scores.performance).toBe(92);
      expect(parsed.scores.accessibility).toBe(85);
      expect(parsed.scores.bestPractices).toBe(96);
      expect(parsed.scores.seo).toBe(90);

      expect(parsed.metrics.length).toBeGreaterThanOrEqual(2);
      const lcp = parsed.metrics.find((m) => m.name === 'LCP');
      expect(lcp).toBeDefined();
      expect(lcp?.value).toBe('1.2 s');
      expect(lcp?.rating).toBe('good');

      expect(parsed.opportunities.length).toBe(1);
      expect(parsed.opportunities[0].title).toBe('Reduce unused CSS');
      expect(parsed.opportunities[0].description).toBe('Save 45 KB');
    });
  });
});
