// @ts-check
// monitor.js — SSL Expiry & Uptime Monitor with Web Notifications

/**
 * @typedef {{
 *   id: string,
 *   url: string,
 *   domain: string,
 *   status: 'up' | 'down' | 'checking',
 *   sslDaysLeft: number | null,
 *   lastChecked: string,
 *   lastError?: string
 * }} MonitoredSite
 *
 * @typedef {{
 *   type: 'down' | 'ssl_expiring' | 'up',
 *   title: string,
 *   message: string
 * }} MonitorAlert
 */

const STORAGE_KEY = 'sitescope_monitored_watchlist';

/**
 * Retrieve saved watchlist from localStorage.
 * @returns {MonitoredSite[]}
 */
export function getWatchlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save watchlist array to localStorage.
 * @param {MonitoredSite[]} sites
 */
export function saveWatchlist(sites) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Add a site to the watchlist.
 * @param {string} url
 * @param {string} domain
 * @returns {MonitoredSite[]}
 */
export function addMonitoredSite(url, domain) {
  const list = getWatchlist();
  const cleanUrl = url.trim();
  if (!cleanUrl || list.some((s) => s.url.toLowerCase() === cleanUrl.toLowerCase())) {
    return list;
  }

  /** @type {MonitoredSite} */
  const newItem = {
    id: `mon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    url: cleanUrl,
    domain: domain || cleanUrl,
    status: 'checking',
    sslDaysLeft: null,
    lastChecked: new Date().toISOString()
  };

  const updated = [newItem, ...list];
  saveWatchlist(updated);
  return updated;
}

/**
 * Remove a site from the watchlist by ID.
 * @param {string} id
 * @returns {MonitoredSite[]}
 */
export function removeMonitoredSite(id) {
  const updated = getWatchlist().filter((s) => s.id !== id);
  saveWatchlist(updated);
  return updated;
}

/**
 * Evaluate alert conditions for a monitored site check.
 * @param {'up'|'down'|'checking'} previousStatus
 * @param {'up'|'down'} currentStatus
 * @param {number|null} sslDays
 * @returns {MonitorAlert[]}
 */
export function evaluateAlertConditions(previousStatus, currentStatus, sslDays) {
  /** @type {MonitorAlert[]} */
  const alerts = [];

  // Site Down Alert
  if (currentStatus === 'down' && previousStatus !== 'down') {
    alerts.push({
      type: 'down',
      title: '🚨 Website Outage Detected',
      message: 'Target website appears to be DOWN or unreachable.'
    });
  }

  // SSL Certificate Expiry Alert (< 30 days)
  if (sslDays !== null && sslDays <= 30 && sslDays >= 0) {
    alerts.push({
      type: 'ssl_expiring',
      title: '⚠️ SSL Certificate Expiring Soon',
      message: `SSL Certificate expires in ${sslDays} days. Please renew soon!`
    });
  }

  return alerts;
}

/**
 * Request browser Web Notification permissions.
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

/**
 * Send a native browser Notification.
 * @param {string} title
 * @param {string} body
 */
export function sendNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico'
    });
  }
}
