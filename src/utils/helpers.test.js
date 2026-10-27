import { describe, it, expect } from 'vitest';
import { escapeHtml, normalizeUrl, getDomain, safeHref } from './helpers.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('passes through safe strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes ampersands first', () => {
    expect(escapeHtml('a&b<c')).toBe('a&amp;b&lt;c');
  });
});

describe('normalizeUrl', () => {
  it('adds https:// if missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('preserves https://', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('preserves http://', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('returns null for empty input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

describe('getDomain', () => {
  it('extracts hostname from URL', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('strips www.', () => {
    expect(getDomain('https://www.google.com')).toBe('google.com');
  });

  it('handles subdomains', () => {
    expect(getDomain('https://api.github.com')).toBe('api.github.com');
  });
});

describe('safeHref', () => {
  it('returns safe https URL', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com');
  });

  it('returns safe http URL', () => {
    expect(safeHref('http://example.com')).toBe('http://example.com');
  });

  it('blocks javascript: protocol', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#');
  });

  it('returns # for non-string', () => {
    expect(safeHref(null)).toBe('#');
    expect(safeHref(undefined)).toBe('#');
    expect(safeHref(42)).toBe('#');
  });
});
