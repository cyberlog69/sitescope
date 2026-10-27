import { describe, it, expect } from 'vitest';
import { cleanDomainKey, getHostname, findServiceByDomain, indicatorToStatus } from './detector.js';

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
