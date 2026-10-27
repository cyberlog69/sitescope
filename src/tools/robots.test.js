import { describe, it, expect } from 'vitest';
import { parseRobotsTxt } from './robots.js';

describe('parseRobotsTxt', () => {
  it('returns null for empty content', () => {
    expect(parseRobotsTxt('')).toBeNull();
    expect(parseRobotsTxt(null)).toBeNull();
  });

  it('returns null when content looks like an HTML error page', () => {
    expect(parseRobotsTxt('<html><body>404</body></html>')).toBeNull();
  });

  it('parses a single user-agent group with allow/disallow rules', () => {
    const content = [
      'User-agent: *',
      'Disallow: /admin',
      'Allow: /public',
      'Sitemap: https://example.com/sitemap.xml'
    ].join('\n');

    const result = parseRobotsTxt(content);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].agent).toBe('*');
    expect(result.rules[0].disallow).toEqual(['/admin']);
    expect(result.rules[0].allow).toEqual(['/public']);
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('parses multiple user-agent groups', () => {
    const content = [
      'User-agent: Googlebot',
      'Disallow: /private',
      '',
      'User-agent: Bingbot',
      'Disallow: /secret',
    ].join('\n');

    const result = parseRobotsTxt(content);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].agent).toBe('Googlebot');
    expect(result.rules[1].agent).toBe('Bingbot');
  });

  it('ignores comments and blank lines', () => {
    const content = [
      '# This is a comment',
      'User-agent: *',
      '',
      '# another comment',
      'Disallow: /admin',
    ].join('\n');

    const result = parseRobotsTxt(content);
    expect(result.rules[0].disallow).toEqual(['/admin']);
  });

  it('collects sitemaps even without a preceding user-agent', () => {
    const content = 'Sitemap: https://example.com/sitemap1.xml\nSitemap: https://example.com/sitemap2.xml';
    const result = parseRobotsTxt(content);
    expect(result.sitemaps).toHaveLength(2);
  });
});
