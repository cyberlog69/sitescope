import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cleanDomainKey,
  getHostname,
  findServiceByDomain,
  indicatorToStatus,
  normalizeOutageReports,
  submitOutageReport,
} from './detector.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cleanDomainKey', () => {
  it('strips scheme and www', () => {
    expect(cleanDomainKey('https://www.example.com')).toBe('example.com');
  });

  it('extracts only the hostname from a full URL (path/query dropped)', () => {
    expect(cleanDomainKey('HTTPS://Example.com/Path?a=b')).toBe('example.com');
  });

  it('handles bare domains without scheme', () => {
    expect(cleanDomainKey('github.com')).toBe('github.com');
  });

  it('replaces unsafe characters in a bare (non-URL) domain string', () => {
    expect(cleanDomainKey('example.com:8080')).toBe('example.com_8080');
  });

  it('falls back gracefully on malformed input', () => {
    expect(cleanDomainKey('not a url!!')).toBe('not_a_url__');
  });
});

describe('getHostname', () => {
  it('extracts hostname from a full URL', () => {
    expect(getHostname('https://www.github.com/some/path')).toBe('github.com');
  });

  it('passes through a bare domain, lowercased', () => {
    expect(getHostname('GITHUB.COM')).toBe('github.com');
  });

  it('strips www. prefix', () => {
    expect(getHostname('https://www.openai.com')).toBe('openai.com');
  });
});

describe('findServiceByDomain', () => {
  it('finds an exact match', () => {
    const service = findServiceByDomain('github.com');
    expect(service).not.toBeNull();
    expect(service.name).toBe('GitHub');
  });

  it('finds a subdomain match', () => {
    const service = findServiceByDomain('status.github.com');
    expect(service).not.toBeNull();
    expect(service.name).toBe('GitHub');
  });

  it('returns null for unknown domains', () => {
    expect(findServiceByDomain('some-random-site.example')).toBeNull();
  });
});

describe('indicatorToStatus', () => {
  it('maps "none" to Online', () => {
    expect(indicatorToStatus('none').status).toBe('Online');
  });

  it('maps "minor" to Degraded', () => {
    expect(indicatorToStatus('minor').status).toBe('Degraded');
  });

  it('maps "major" and "critical" to Outage', () => {
    expect(indicatorToStatus('major').status).toBe('Outage');
    expect(indicatorToStatus('critical').status).toBe('Outage');
  });

  it('maps unknown indicators to Unknown', () => {
    expect(indicatorToStatus('bogus').status).toBe('Unknown');
  });
});

describe('normalizeOutageReports', () => {
  it('drops non-array input, invalid dates, and timestamps outside the last 24h', () => {
    const now = Date.now();
    const valid = now - 60 * 1000;
    const reports = normalizeOutageReports([
      new Date(valid).toISOString(),
      'not-a-date',
      null,
      new Date(now - 3 * 86400000).toISOString(),
      new Date(now + 10 * 86400000).toISOString(),
    ]);

    expect(reports).toEqual([valid]);
    expect(normalizeOutageReports(null)).toEqual([]);
    expect(normalizeOutageReports('nope')).toEqual([]);
  });

  it('deduplicates reports that fall in the same minute', () => {
    const now = Date.now();
    // Pin the timestamps inside one minute so the test cannot straddle a boundary.
    const base = Math.floor((now - 5 * 60 * 1000) / 60000) * 60000 + 10000;
    const reports = normalizeOutageReports([
      new Date(base).toISOString(),
      new Date(base + 1000).toISOString(),
      new Date(base + 2000).toISOString(),
    ]);

    expect(reports).toHaveLength(1);
  });

  it('caps the list at 1000 entries', () => {
    const now = Date.now();
    const reports = normalizeOutageReports(
      Array.from({ length: 1200 }, (_, i) => new Date(now - (i + 1) * 60000).toISOString()),
    );
    expect(reports).toHaveLength(1000);
  });
});

describe('submitOutageReport', () => {
  it('does not post again during the per-browser cooldown', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('outage_reported_example.com', String(Date.now()));

    const reports = await submitOutageReport('example.com');

    expect(reports).toEqual([]);
    expect(fetchMock.mock.calls.some(([, init]) => init && init.method === 'POST')).toBe(false);
  });

  it('records a report and falls back to localStorage when kvdb is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const reports = await submitOutageReport('example.com');

    expect(reports).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('outages_example.com'))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([, init]) => init && init.method === 'POST')).toBe(true);
  });
});
