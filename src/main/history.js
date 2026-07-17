// @ts-check
// history.js — Scan history storage: cloud sync (kvdb.io) + localStorage fallback.
//
// localStorage is the source of truth for "instant" reads/writes — history
// always saves even if the network request fails. kvdb.io is used as a
// best-effort cross-device cloud sync layer on top of that.

import { logWarn } from '../utils/logger.js';

/**
 * @typedef {{ url: string, title: string, favicon: string, threat: string, time: string }} HistoryEntry
 */

export const HISTORY_LS_KEY = 'sitescope_scan_history';
export const HISTORY_KV_KEY = 'history';
export const HISTORY_KV_URL = `https://kvdb.io/sitescope_v4_history/${HISTORY_KV_KEY}`;
export const HISTORY_MAX = 50;

/**
 * Read scan history from localStorage.
 * @returns {HistoryEntry[]}
 */
export function lsGetHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist scan history to localStorage.
 * @param {HistoryEntry[]} items
 * @returns {void}
 */
export function lsSaveHistory(items) {
  try {
    localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable/full — ignore, cloud sync is best-effort anyway
  }
}

/**
 * Fetch cloud history. Returns `null` on network failure (distinct from an
 * empty list, which is a valid "no history yet" cloud response).
 * @returns {Promise<HistoryEntry[] | null>}
 */
export async function fetchCloudHistory() {
  try {
    const res = await fetch(HISTORY_KV_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.trim()) return [];
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Merge cloud + local history, deduplicate by URL (cloud wins on conflict),
 * sort newest first, cap to HISTORY_MAX.
 * @param {HistoryEntry[] | null | undefined} cloud
 * @param {HistoryEntry[] | null | undefined} local
 * @returns {HistoryEntry[]}
 */
export function mergeHistories(cloud, local) {
  /** @type {Map<string, HistoryEntry>} */
  const map = new Map();
  // local first so cloud can overwrite with fresher data
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(cloud) ? cloud : [])].forEach(
    (item) => {
      if (item && item.url) map.set(item.url, item);
    }
  );
  return [...map.values()]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, HISTORY_MAX);
}

/**
 * Save a new scan result to history: writes localStorage immediately, then
 * attempts a best-effort cloud sync.
 * @param {{ url: string, title?: string|null, favicon?: string|null, threatLevel?: string|null }} params
 * @returns {Promise<HistoryEntry[]>} the updated local history list
 */
export async function saveHistoryEntry({ url, title, favicon, threatLevel }) {
  /** @type {HistoryEntry} */
  const newEntry = {
    url,
    title: title || url,
    favicon: favicon || '',
    threat: threatLevel || 'safe',
    time: new Date().toISOString()
  };

  // 1. Always save to localStorage first (instant, reliable)
  let local = lsGetHistory();
  local = local.filter((item) => item.url !== url);
  local.unshift(newEntry);
  local = local.slice(0, HISTORY_MAX);
  lsSaveHistory(local);

  // 2. Try cloud sync in background (best-effort)
  try {
    let cloud = await fetchCloudHistory();
    if (!Array.isArray(cloud)) cloud = local;
    cloud = cloud.filter((item) => item.url !== url);
    cloud.unshift(newEntry);
    cloud = cloud.slice(0, HISTORY_MAX);

    await fetch(HISTORY_KV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloud),
      signal: AbortSignal.timeout(6000)
    });
  } catch (err) {
    logWarn('history:saveHistoryEntry:cloud-sync', err);
  }

  return local;
}

/**
 * Clear both local and cloud history.
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  lsSaveHistory([]);
  try {
    await fetch(HISTORY_KV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
      signal: AbortSignal.timeout(6000)
    });
  } catch (err) {
    logWarn('history:clearHistory:cloud-clear', err);
  }
}

/**
 * Load the merged (local ∪ cloud) history list. Local data is returned
 * immediately to the caller via `onLocal` (if provided) while cloud data is
 * fetched and merged in the background.
 * @param {(local: HistoryEntry[]) => void} [onLocal]
 * @returns {Promise<HistoryEntry[]>}
 */
export async function loadMergedHistory(onLocal) {
  const localData = lsGetHistory();
  if (typeof onLocal === 'function') onLocal(localData);

  const cloudData = await fetchCloudHistory();
  const merged = mergeHistories(cloudData, localData);
  if (merged.length > 0) lsSaveHistory(merged);
  return merged;
}
