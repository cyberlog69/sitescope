import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./utils/proxy.js', () => ({ fetchViaCorsProxy: vi.fn() }));

import { fetchViaCorsProxy } from './utils/proxy.js';
import { fetchWhois, fetchHttpHeaders } from './intel.js';

const proxyMock = vi.mocked(fetchViaCorsProxy);

beforeEach(() => {
  document.body.innerHTML = '<div id="intelWhois"></div><div id="intelHeaders"></div>';
  proxyMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWhois', () => {
  it('renders registrar and dates from the direct RDAP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entities: [
            {
              roles: ['registrar'],
              vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]],
            },
          ],
          events: [
            { eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' },
            { eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' },
          ],
        }),
      }),
    );

    await fetchWhois('example.com');

    const el = document.getElementById('intelWhois');
    expect(el.textContent).toContain('Example Registrar');
    expect(el.textContent).toContain('Created');
    expect(el.textContent).toContain('Expires');
  });

  it('falls back to the proxied RDAP endpoint when the direct call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));
    proxyMock.mockResolvedValue({
      contents: JSON.stringify({
        entities: [
          { roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Fallback Registrar']]] },
        ],
      }),
    });

    await fetchWhois('example.com');

    expect(proxyMock).toHaveBeenCalledWith(expect.stringContaining('rdap.verisign.com'), {
      timeout: 6000,
    });
    expect(document.getElementById('intelWhois').textContent).toContain('Fallback Registrar');
  });

  it('reports unavailability when both sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    proxyMock.mockResolvedValue(null);

    await fetchWhois('example.com');
    expect(document.getElementById('intelWhois').textContent).toBe('WHOIS unavailable');
  });

  it('does nothing when the target element is absent', async () => {
    document.body.innerHTML = '';
    await expect(fetchWhois('example.com')).resolves.toBeUndefined();
    expect(proxyMock).not.toHaveBeenCalled();
  });
});

describe('fetchHttpHeaders', () => {
  it('parses security headers into the DOM and a lowercased map', async () => {
    proxyMock.mockResolvedValue({
      contents: [
        'HTTP/1.1 200 OK',
        'Server: nginx',
        'Strict-Transport-Security: max-age=31536000; includeSubDomains',
        'X-Powered-By: Express',
        'Content-Type: text/html',
        'Set-Cookie: session=secret',
      ].join('\n'),
    });

    const headers = await fetchHttpHeaders('example.com');

    expect(headers.server).toBe('nginx');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
    expect(headers['x-powered-by']).toBe('Express');

    const el = document.getElementById('intelHeaders');
    expect(el.textContent).toContain('strict-transport-security');
    expect(el.textContent).not.toContain('session=secret');
  });

  it('reports rate limiting without throwing', async () => {
    proxyMock.mockResolvedValue({ contents: 'error code: 1015 rate limit exceeded' });

    const headers = await fetchHttpHeaders('example.com');

    expect(headers).toEqual({});
    expect(document.getElementById('intelHeaders').textContent).toContain('rate-limit');
  });

  it('reports when no significant headers are present', async () => {
    proxyMock.mockResolvedValue({ contents: 'X-Custom: value' });

    await fetchHttpHeaders('example.com');
    expect(document.getElementById('intelHeaders').textContent).toContain(
      'No significant security headers detected',
    );
  });

  it('returns an empty map when the request fails', async () => {
    proxyMock.mockRejectedValue(new Error('proxy down'));
    expect(await fetchHttpHeaders('example.com')).toEqual({});
  });
});
