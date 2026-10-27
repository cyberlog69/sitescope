import { describe, it, expect } from 'vitest';
import { detectTechnologies } from './stack.js';

describe('detectTechnologies', () => {
  it('detects Cloudflare from headers', () => {
    const detected = detectTechnologies('', { 'cf-ray': '1234-ABC' });
    expect(detected.some(t => t.name === 'Cloudflare')).toBe(true);
  });

  it('detects Nginx from server header', () => {
    const detected = detectTechnologies('', { server: 'nginx/1.18.0' });
    expect(detected.some(t => t.name === 'Nginx')).toBe(true);
  });

  it('detects WordPress from HTML markers', () => {
    const detected = detectTechnologies('<link href="/wp-content/themes/foo/style.css">', {});
    expect(detected.some(t => t.name === 'WordPress')).toBe(true);
  });

  it('detects React from HTML markers', () => {
    const detected = detectTechnologies('<div id="react-root"></div>', {});
    expect(detected.some(t => t.name === 'React')).toBe(true);
  });

  it('detects Next.js from HTML markers', () => {
    const detected = detectTechnologies('<script src="/_next/static/chunk.js"></script>', {});
    expect(detected.some(t => t.name === 'Next.js')).toBe(true);
  });

  it('detects Google Analytics', () => {
    const detected = detectTechnologies('<script src="https://www.google-analytics.com/analytics.js"></script>', {});
    expect(detected.some(t => t.name === 'Google Analytics')).toBe(true);
  });

  it('returns an empty array when nothing matches', () => {
    const detected = detectTechnologies('<html><body>Plain page</body></html>', {});
    expect(detected).toEqual([]);
  });

  it('handles null/undefined html and headers gracefully', () => {
    expect(() => detectTechnologies(null, null)).not.toThrow();
    expect(detectTechnologies(undefined, undefined)).toEqual([]);
  });
});
