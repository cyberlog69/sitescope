import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  HISTORY_LS_KEY,
  lsGetHistory,
  lsSaveHistory,
  mergeHistories,
  fetchCloudHistory,
  saveHistoryEntry,
  clearHistory,
  loadMergedHistory
} from './history.js';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lsGetHistory / lsSaveHistory', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(lsGetHistory()).toEqual([]);
  });

  it('round-trips data through localStorage', () => {
    const items = [{ url: 'https://a.com', title: 'A', favicon: '', threat: 'safe', time: '2024-01-01T00:00:00.000Z' }];
    lsSaveHistory(items);
    expect(lsGetHistory()).toEqual(items);
  });

  it('returns an empty array for corrupted JSON', () => {
    localStorage.setItem(HISTORY_LS_KEY, '{not json');
    expect(lsGetHistory()).toEqual([]);
  });
});

describe('mergeHistories', () => {
  it('deduplicates by url, preferring cloud entries', () => {
    const local = [{ url: 'https://a.com', title: 'Local A', time: '2024-01-01T00:00:00.000Z' }];
    const cloud = [{ url: 'https://a.com', title: 'Cloud A', time: '2024-01-02T00:00:00.000Z' }];
    const merged = mergeHistories(cloud, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Cloud A');
  });

  it('sorts newest first', () => {
    const local = [
      { url: 'https://old.com', title: 'Old', time: '2024-01-01T00:00:00.000Z' },
      { url: 'https://new.com', title: 'New', time: '2024-06-01T00:00:00.000Z' }
    ];
    const merged = mergeHistories(null, local);
    expect(merged[0].url).toBe('https://new.com');
    expect(merged[1].url).toBe('https://old.com');
  });

  it('handles null/undefined inputs safely', () => {
    expect(mergeHistories(null, undefined)).toEqual([]);
    expect(mergeHistories(undefined, null)).toEqual([]);
  });

  it('caps result to HISTORY_MAX (50) entries', () => {
    const local = Array.from({ length: 60 }, (_, i) => ({
      url: `https://site${i}.com`,
      title: `Site ${i}`,
      time: new Date(2024, 0, i + 1).toISOString()
    }));
    const merged = mergeHistories(null, local);
    expect(merged.length).toBe(50);
  });
});

describe('fetchCloudHistory', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ url: 'https://a.com' }])
    }));
    const result = await fetchCloudHistory();
    expect(result).toEqual([{ url: 'https://a.com' }]);
  });

  it('returns an empty array for an empty (but ok) response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));
    expect(await fetchCloudHistory()).toEqual([]);
  });

  it('returns null on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchCloudHistory()).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchCloudHistory()).toBeNull();
  });
});

describe('saveHistoryEntry', () => {
  it('always saves to localStorage even if cloud sync fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await saveHistoryEntry({ url: 'https://example.com', title: 'Example', threatLevel: 'low' });

    expect(result[0].url).toBe('https://example.com');
    expect(result[0].threat).toBe('low');
    expect(lsGetHistory()[0].url).toBe('https://example.com');
  });

  it('deduplicates existing entries for the same URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await saveHistoryEntry({ url: 'https://example.com', title: 'First' });
    const result = await saveHistoryEntry({ url: 'https://example.com', title: 'Second' });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Second');
  });
});

describe('clearHistory', () => {
  it('clears localStorage even if the cloud request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    lsSaveHistory([{ url: 'https://a.com', title: 'A', time: '2024-01-01T00:00:00.000Z' }]);

    await clearHistory();

    expect(lsGetHistory()).toEqual([]);
  });
});

describe('loadMergedHistory', () => {
  it('invokes onLocal synchronously with local data before resolving merged data', async () => {
    lsSaveHistory([{ url: 'https://local.com', title: 'Local', time: '2024-01-01T00:00:00.000Z' }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ url: 'https://cloud.com', title: 'Cloud', time: '2024-06-01T00:00:00.000Z' }])
    }));

    const onLocal = vi.fn();
    const merged = await loadMergedHistory(onLocal);

    expect(onLocal).toHaveBeenCalledWith([
      { url: 'https://local.com', title: 'Local', time: '2024-01-01T00:00:00.000Z' }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].url).toBe('https://cloud.com');
  });
});
