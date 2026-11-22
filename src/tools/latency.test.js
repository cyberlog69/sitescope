import { describe, it, expect, vi, afterEach } from 'vitest';
import { measureLatencySingle, runLatencySuite, renderLatencyPanel } from './latency.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('measureLatencySingle', () => {
  it('measures elapsed time for a successful probe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const elapsed = await measureLatencySingle('https://example.com');
    expect(typeof elapsed).toBe('number');
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('still returns a number when the probe rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const elapsed = await measureLatencySingle('https://example.com');
    expect(Number.isFinite(elapsed)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});

describe('runLatencySuite', () => {
  it('runs the requested number of trials and returns rounded values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const trials = await runLatencySuite('https://example.com', 2);
    expect(trials).toHaveLength(2);
    trials.forEach((value) => expect(Number.isInteger(value)).toBe(true));
  });
});

describe('renderLatencyPanel', () => {
  it('renders average and p95 figures', () => {
    const container = document.createElement('div');
    renderLatencyPanel([100, 200, 300], container);
    expect(container.innerHTML).toContain('Average');
    expect(container.textContent).toContain('200ms');
    expect(container.textContent).toContain('95th%');
    expect(container.textContent).toContain('300ms');
  });

  it('labels slow probes and shows the performance grade', () => {
    const container = document.createElement('div');
    renderLatencyPanel([400, 450], container);
    expect(container.textContent).toContain('Slow Connection');
  });

  it('shows a placeholder without trials', () => {
    const container = document.createElement('div');
    renderLatencyPanel([], container);
    expect(container.textContent).toContain('Latency test unavailable');
  });

  it('accepts a null container without throwing', () => {
    expect(() => renderLatencyPanel([1], null)).not.toThrow();
  });
});
