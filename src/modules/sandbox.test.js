import { describe, it, expect } from 'vitest';
import { sanitizeForSandbox } from './sandbox.js';

describe('sanitizeForSandbox', () => {
  it('removes script tags', () => {
    const html = '<html><body><script>alert("xss")</script><p>hello</p></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('hello');
    expect(result.stats.scripts).toBe(1);
  });

  it('removes iframes', () => {
    const html = '<html><body><iframe src="https://evil.com"></iframe></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).not.toContain('<iframe');
    expect(result.stats.iframes).toBe(1);
  });

  it('disables forms', () => {
    const html = '<html><body><form action="https://evil.com"><input type="submit"/></form></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).toContain('action="about:blank"');
    expect(result.stats.forms).toBe(1);
  });

  it('strips inline event handlers including custom on* attributes', () => {
    const html = '<html><body><button onclick="alert(1)" oncustom="alert(2)" formaction="javascript:alert(3)">click</button></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).not.toContain('onclick');
    expect(result.html).not.toContain('oncustom');
    expect(result.html).not.toContain('formaction');
    expect(result.stats.handlers).toBeGreaterThanOrEqual(2);
  });

  it('neutralizes javascript: URLs', () => {
    const html = '<html><body><a href="javascript:alert(1)">link</a></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).toContain('href="#"');
    expect(result.html).not.toContain('javascript:');
  });

  it('injects a CSP meta tag', () => {
    const html = '<html><head></head><body></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).toContain('Content-Security-Policy');
    expect(result.html).toContain("script-src 'none'");
  });

  it('injects a base tag', () => {
    const html = '<html><head></head><body></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.html).toContain('<base href="https://example.com" target="_blank">');
  });

  it('returns extracted links', () => {
    const html = '<html><body><a href="/page">Page</a></body></html>';
    const result = sanitizeForSandbox(html, 'https://example.com');
    expect(result.links.length).toBe(1);
    expect(result.links[0].url).toBe('https://example.com/page');
  });
});
