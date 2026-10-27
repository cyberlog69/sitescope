import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseBulkUrls, fetchSiteData, fallbackSiteData, MAX_BULK_URLS } from './bulk.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseBulkUrls', () => {
  it('splits on newlines and commas, trims, and normalizes', () => {
    const text = 'example.com\nhttps://foo.com, bar.com';
    const urls = parseBulkUrls(text);
    expect(urls).toEqual(['https://example.com/', 'https://foo.com/', 'https://bar.com/']);
  });

  it('drops invalid/empty entries', () => {
    const text = 'example.com,,   ,\nnot a url with spaces!!';
    const urls = parseBulkUrls(text);
    expect(urls).toContain('https://example.com/');
    expect(urls.every(Boolean)).toBe(true);
  });

  it('caps results to the max limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => `site${i}.com`).join('\n');
    expect(parseBulkUrls(many).length).toBe(MAX_BULK_URLS);
  });

  it('respects a custom max override', () => {
    const many = Array.from({ length: 10 }, (_, i) => `site${i}.com`).join('\n');
    expect(parseBulkUrls(many, 3)).toHaveLength(3);
  });
});

describe('fetchSiteData', () => {
  it('returns an ok result with metadata on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        status: 'success',
        data: { title: 'Example Site', description: 'A test site', lang: 'en' }
      })
    }));

    const result = await fetchSiteData('https://example.com');
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Example Site');
    expect(result.desc).toBe('A test site');
    expect(result.lang).toBe('en');
    expect(result.category).toBeDefined();
    expect(result.threat).toBeDefined();
  });

  it('returns a non-ok result when the API reports failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ status: 'fail' })
    }));

    const result = await fetchSiteData('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.desc).toBe('Could not fetch metadata.');
  });
});

describe('fallbackSiteData', () => {
  it('builds a non-ok placeholder result without making network calls', () => {
    const result = fallbackSiteData('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.url).toBe('https://example.com');
    expect(result.desc).toBe('Error fetching data.');
    expect(result.category).toBeDefined();
    expect(result.threat).toBeDefined();
  });
});
