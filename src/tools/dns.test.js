import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDnsRecord, fetchAllDns, renderDnsPanel } from './dns.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDnsRecord', () => {
  it('returns the Answer array for a successful lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }] }),
      }),
    );

    const answers = await fetchDnsRecord('example.com', 'A');
    expect(answers).toHaveLength(1);
    expect(answers[0].data).toBe('93.184.216.34');
  });

  it('returns an empty array for a response without answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await fetchDnsRecord('example.com', 'MX')).toEqual([]);
  });

  it('returns an empty array on HTTP or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await fetchDnsRecord('example.com', 'TXT')).toEqual([]);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchDnsRecord('example.com', 'TXT')).toEqual([]);
  });
});

describe('fetchAllDns', () => {
  it('queries every record type and keys the results by type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const type = new URL(url).searchParams.get('type');
        return {
          ok: true,
          json: async () => ({
            Answer: type === 'A' ? [{ name: 'example.com', type: 1, TTL: 60, data: '1.2.3.4' }] : [],
          }),
        };
      }),
    );

    const results = await fetchAllDns('example.com');
    expect(Object.keys(results).sort()).toEqual(['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'SOA', 'TXT']);
    expect(results.A[0].data).toBe('1.2.3.4');
    expect(results.MX).toEqual([]);
  });
});

describe('renderDnsPanel', () => {
  it('renders records, counts, and SPF/DMARC badges', () => {
    const container = document.createElement('div');
    renderDnsPanel(
      {
        A: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }],
        TXT: [
          { name: 'example.com', type: 16, TTL: 300, data: 'v=spf1 include:_spf.example.com ~all' },
          { name: 'example.com', type: 16, TTL: 300, data: 'v=DMARC1; p=reject' },
        ],
      },
      container,
    );

    expect(container.innerHTML).toContain('Total Records');
    expect(container.innerHTML).toContain('SPF Configured');
    expect(container.innerHTML).toContain('DMARC Configured');
    expect(container.innerHTML).toContain('93.184.216.34');
  });

  it('flags missing SPF/DMARC when TXT records do not contain them', () => {
    const container = document.createElement('div');
    renderDnsPanel({ A: [{ name: 'example.com', type: 1, TTL: 60, data: '1.1.1.1' }] }, container);
    expect(container.innerHTML).toContain('SPF Missing');
    expect(container.innerHTML).toContain('DMARC Missing');
  });

  it('shows a placeholder when no records exist', () => {
    const container = document.createElement('div');
    renderDnsPanel({}, container);
    expect(container.textContent).toContain('No DNS records retrieved');
  });

  it('escapes record data before injecting it into the DOM', () => {
    const container = document.createElement('div');
    renderDnsPanel(
      { TXT: [{ name: 'x', type: 16, TTL: 1, data: '<img src=x onerror=alert(1)>' }] },
      container,
    );
    expect(container.innerHTML).not.toContain('<img src=x');
    expect(container.innerHTML).toContain('&lt;img');
  });

  it('accepts a null container without throwing', () => {
    expect(() => renderDnsPanel({}, null)).not.toThrow();
  });
});
