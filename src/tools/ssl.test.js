import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/proxy.js', () => ({ fetchViaCorsProxy: vi.fn() }));

import { fetchViaCorsProxy } from '../utils/proxy.js';
import { fetchSslInfo, summarizeSslInfo, renderSslPanel } from './ssl.js';

const proxyMock = vi.mocked(fetchViaCorsProxy);

const DAY = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('summarizeSslInfo', () => {
  it('picks the active certificate with the furthest expiry', () => {
    const now = Date.now();
    const summary = summarizeSslInfo(
      [
        { not_before: iso(-300), not_after: iso(10), issuer_name: 'Old CA' },
        { not_before: iso(-10), not_after: iso(200), issuer_name: 'New CA' },
      ],
      now,
    );

    expect(summary).not.toBeNull();
    expect(summary.valid).toBe(true);
    expect(summary.daysRemaining).toBe(200);
    expect(summary.issuer).toBe('New CA');
    expect(summary.expiresAt).toBeTruthy();
  });

  it('reports an expired-only certificate as invalid with zero days left', () => {
    const summary = summarizeSslInfo([{ not_before: iso(-400), not_after: iso(-5) }]);
    expect(summary.valid).toBe(false);
    expect(summary.daysRemaining).toBe(0);
  });

  it('returns null for empty, missing, or unparseable data', () => {
    expect(summarizeSslInfo(null)).toBeNull();
    expect(summarizeSslInfo(undefined)).toBeNull();
    expect(summarizeSslInfo([])).toBeNull();
    expect(summarizeSslInfo([{ not_before: 'x', not_after: 'not-a-date' }])).toBeNull();
  });
});

describe('fetchSslInfo', () => {
  it('parses the crt.sh JSON returned by the proxy', async () => {
    proxyMock.mockResolvedValue({
      contents: JSON.stringify([{ not_before: iso(-1), not_after: iso(90), common_name: 'example.com' }]),
    });

    const certs = await fetchSslInfo('example.com');
    expect(certs).toHaveLength(1);
    expect(certs[0].common_name).toBe('example.com');
    expect(proxyMock).toHaveBeenCalledWith(
      expect.stringContaining('crt.sh/?q=example.com&output=json'),
    );
  });

  it('returns null when every proxy fails', async () => {
    proxyMock.mockResolvedValue(null);
    expect(await fetchSslInfo('example.com')).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    proxyMock.mockResolvedValue({ contents: 'not json' });
    expect(await fetchSslInfo('example.com')).toBeNull();
  });
});

describe('renderSslPanel', () => {
  it('renders the grade, issuer, expiry, and SANs', () => {
    const container = document.createElement('div');
    renderSslPanel(
      [
        {
          not_before: iso(-10),
          not_after: iso(120),
          issuer_name: 'O=Example CA, CN=Example CA',
          common_name: 'example.com',
        },
      ],
      'example.com',
      container,
    );

    expect(container.textContent).toContain('SSL Grade');
    expect(container.textContent).toMatch(/\d+ Days Left/);
    expect(container.textContent).toContain('Example CA');
    expect(container.textContent).toContain('example.com');
  });

  it('shows a message when no certificate logs exist', () => {
    const container = document.createElement('div');
    renderSslPanel([], 'example.com', container);
    expect(container.textContent).toContain('No certificate logs found');
  });

  it('escapes the domain and SANs', () => {
    const container = document.createElement('div');
    renderSslPanel(
      [{ not_before: iso(-1), not_after: iso(30), common_name: '<img src=x onerror=alert(1)>' }],
      '<script>x</script>',
      container,
    );
    expect(container.innerHTML).not.toContain('<script>x</script>');
    expect(container.innerHTML).not.toContain('<img src=x');
  });

  it('accepts a null container without throwing', () => {
    expect(() => renderSslPanel(null, 'example.com', null)).not.toThrow();
  });
});
