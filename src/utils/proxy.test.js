import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchViaCorsProxy } from './proxy.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchViaCorsProxy', () => {
  it('returns contents from the primary (allorigins) proxy on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contents: '<html>primary</html>' })
    }));

    const result = await fetchViaCorsProxy('https://example.com');
    expect(result).toEqual({ contents: '<html>primary</html>' });
  });

  it('falls back to the secondary proxy when the primary fails', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({ ok: true, text: async () => '<html>secondary</html>' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchViaCorsProxy('https://example.com');
    expect(result).toEqual({ contents: '<html>secondary</html>' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the secondary proxy when the primary returns a non-ok response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, text: async () => 'fallback body' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchViaCorsProxy('https://example.com');
    expect(result).toEqual({ contents: 'fallback body' });
  });

  it('returns null when all proxies fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('all down')));
    const result = await fetchViaCorsProxy('https://example.com');
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('appends a cache-busting timestamp when requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ contents: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchViaCorsProxy('https://example.com', { cacheBust: true });
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('timestamp=');
  });
});
