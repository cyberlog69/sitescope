// @ts-check
// pagespeed.js — Google PageSpeed Insights & Core Web Vitals Engine

/**
 * @typedef {{
 *   performance: number|null,
 *   accessibility: number|null,
 *   bestPractices: number|null,
 *   seo: number|null
 * }} PageSpeedScores
 *
 * @typedef {{
 *   name: string,
 *   title: string,
 *   value: string,
 *   score: number|null,
 *   rating: 'good' | 'needs-improvement' | 'poor' | 'unknown'
 * }} CoreVitalMetric
 *
 * @typedef {{
 *   title: string,
 *   description: string,
 *   displayValue?: string
 * }} PageSpeedOpportunity
 *
 * @typedef {{
 *   scores: PageSpeedScores,
 *   metrics: CoreVitalMetric[],
 *   opportunities: PageSpeedOpportunity[],
 *   error?: string
 * }} PageSpeedResult
 */

/**
 * Determine performance rating from score (0-1).
 * @param {number|null|undefined} score
 * @returns {'good' | 'needs-improvement' | 'poor' | 'unknown'}
 */
export function getMetricRating(score) {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 0.9) return 'good';
  if (score >= 0.5) return 'needs-improvement';
  return 'poor';
}

/**
 * Format score number (0-1) to 0-100 percentage integer.
 * @param {number|null|undefined} score
 * @returns {number|null}
 */
export function formatScoreInt(score) {
  if (typeof score !== 'number') return null;
  return Math.round(score * 100);
}

/**
 * Parse raw PageSpeed Insights API payload into structured PageSpeedResult.
 * @param {any} data
 * @returns {PageSpeedResult}
 */
export function parsePageSpeedResponse(data) {
  if (!data || !data.lighthouseResult) {
    return {
      scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
      metrics: [],
      opportunities: [],
      error: data?.error?.message || 'Invalid or missing PageSpeed data.'
    };
  }

  const lh = data.lighthouseResult;
  const categories = lh.categories || {};
  const audits = lh.audits || {};

  const scores = {
    performance: formatScoreInt(categories.performance?.score),
    accessibility: formatScoreInt(categories.accessibility?.score),
    bestPractices: formatScoreInt(categories['best-practices']?.score),
    seo: formatScoreInt(categories.seo?.score)
  };

  /** @type {CoreVitalMetric[]} */
  const metrics = [];

  const vitalsKeys = [
    { key: 'largest-contentful-paint', name: 'LCP', title: 'Largest Contentful Paint' },
    { key: 'first-contentful-paint', name: 'FCP', title: 'First Contentful Paint' },
    { key: 'cumulative-layout-shift', name: 'CLS', title: 'Cumulative Layout Shift' },
    { key: 'total-blocking-time', name: 'TBT', title: 'Total Blocking Time' },
    { key: 'max-potential-fid', name: 'FID', title: 'First Input Delay (Potential)' },
    { key: 'speed-index', name: 'SI', title: 'Speed Index' }
  ];

  vitalsKeys.forEach(({ key, name, title }) => {
    const audit = audits[key];
    if (audit) {
      metrics.push({
        name,
        title,
        value: audit.displayValue || (audit.numericValue ? `${Math.round(audit.numericValue)} ms` : 'N/A'),
        score: audit.score !== undefined ? audit.score : null,
        rating: getMetricRating(audit.score)
      });
    }
  });

  /** @type {PageSpeedOpportunity[]} */
  const opportunities = [];

  Object.values(audits).forEach((audit) => {
    // @ts-ignore
    if (audit && audit.details && audit.details.type === 'opportunity' && typeof audit.score === 'number' && audit.score < 0.9) {
      opportunities.push({
        // @ts-ignore
        title: audit.title || 'Optimization Opportunity',
        // @ts-ignore
        description: (audit.description || '').split('[')[0].trim(),
        // @ts-ignore
        displayValue: audit.displayValue
      });
    }
  });

  // Sort opportunities by priority (worst score / highest impact first)
  opportunities.sort((a, b) => (a.displayValue || '').localeCompare(b.displayValue || ''));

  return {
    scores,
    metrics,
    opportunities: opportunities.slice(0, 6)
  };
}

/**
 * Fetch PageSpeed Insights data for a target URL via Google's free API.
 * @param {string} targetUrl
 * @param {'mobile' | 'desktop'} [strategy='mobile']
 * @returns {Promise<PageSpeedResult>}
 */
export async function fetchPageSpeed(targetUrl, strategy = 'mobile') {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=${strategy}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(18000) });
    if (!res.ok) {
      throw new Error(`PageSpeed API HTTP error ${res.status}`);
    }
    const data = await res.json();
    return parsePageSpeedResponse(data);
  } catch (err) {
    return {
      scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
      metrics: [],
      opportunities: [],
      error: err instanceof Error ? err.message : 'PageSpeed Insights unavailable'
    };
  }
}
