// @ts-check
// comparison.js — Domain Duel / Side-by-Side Site Comparison Engine

/**
 * @typedef {{
 *   url: string,
 *   domain: string,
 *   scorecard?: import('../modules/scorecard.js').ScorecardResult,
 *   security?: import('../modules/security.js').ScanResult,
 *   sslInfo?: { valid?: boolean, daysRemaining?: number },
 *   latencyMs?: number|null,
 *   techCount?: number,
 *   categoryLabel?: string
 * }} SiteDuelData
 *
 * @typedef {'A' | 'B' | 'TIE'} DuelWinner
 *
 * @typedef {{
 *   metric: string,
 *   label: string,
 *   valA: string|number,
 *   valB: string|number,
 *   winner: DuelWinner
 * }} MetricComparison
 *
 * @typedef {{
 *   siteA: SiteDuelData,
 *   siteB: SiteDuelData,
 *   comparisons: MetricComparison[],
 *   overallWinner: DuelWinner,
 *   scoreA: number,
 *   scoreB: number
 * }} DuelResult
 */

/**
 * Compare two sites head-to-head across key security, performance, and stack metrics.
 * @param {SiteDuelData} siteA
 * @param {SiteDuelData} siteB
 * @returns {DuelResult}
 */
export function compareSites(siteA, siteB) {
  /** @type {MetricComparison[]} */
  const comparisons = [];
  let pointsA = 0;
  let pointsB = 0;

  // 1. Security Scorecard Grade
  const scoreA = siteA.scorecard?.score ?? 0;
  const scoreB = siteB.scorecard?.score ?? 0;
  const gradeA = siteA.scorecard?.grade || 'F';
  const gradeB = siteB.scorecard?.grade || 'F';

  let gradeWinner = 'TIE';
  if (scoreA > scoreB) { gradeWinner = 'A'; pointsA += 2; }
  else if (scoreB > scoreA) { gradeWinner = 'B'; pointsB += 2; }

  comparisons.push({
    metric: 'scorecard',
    label: 'Security Scorecard',
    valA: `${gradeA} (${scoreA}/100)`,
    valB: `${gradeB} (${scoreB}/100)`,
    // @ts-ignore
    winner: gradeWinner
  });

  // 2. HTTPS Encryption
  const isHttpsA = siteA.url.startsWith('https://');
  const isHttpsB = siteB.url.startsWith('https://');
  let httpsWinner = 'TIE';
  if (isHttpsA && !isHttpsB) { httpsWinner = 'A'; pointsA += 1; }
  else if (isHttpsB && !isHttpsA) { httpsWinner = 'B'; pointsB += 1; }

  comparisons.push({
    metric: 'https',
    label: 'Protocol Encryption',
    valA: isHttpsA ? '🔒 HTTPS' : '⚠️ HTTP',
    valB: isHttpsB ? '🔒 HTTPS' : '⚠️ HTTP',
    // @ts-ignore
    winner: httpsWinner
  });

  // 3. Threat Scanner Risk Score
  const threatScoreA = siteA.security?.score ?? 0;
  const threatScoreB = siteB.security?.score ?? 0;
  let threatWinner = 'TIE';
  // Lower threat score is better
  if (threatScoreA < threatScoreB) { threatWinner = 'A'; pointsA += 1; }
  else if (threatScoreB < threatScoreA) { threatWinner = 'B'; pointsB += 1; }

  comparisons.push({
    metric: 'threat',
    label: 'Threat Scanner Risk',
    valA: `${siteA.security?.level.toUpperCase() || 'UNKNOWN'} (${threatScoreA})`,
    valB: `${siteB.security?.level.toUpperCase() || 'UNKNOWN'} (${threatScoreB})`,
    // @ts-ignore
    winner: threatWinner
  });

  // 4. Probe Latency (ms)
  const latA = siteA.latencyMs ?? null;
  const latB = siteB.latencyMs ?? null;
  let latWinner = 'TIE';
  if (latA !== null && latB !== null) {
    if (latA < latB) { latWinner = 'A'; pointsA += 1; }
    else if (latB < latA) { latWinner = 'B'; pointsB += 1; }
  } else if (latA !== null) { latWinner = 'A'; pointsA += 1; }
  else if (latB !== null) { latWinner = 'B'; pointsB += 1; }

  comparisons.push({
    metric: 'latency',
    label: 'Network Latency',
    valA: latA !== null ? `${latA} ms` : 'N/A',
    valB: latB !== null ? `${latB} ms` : 'N/A',
    // @ts-ignore
    winner: latWinner
  });

  // 5. SSL Days Remaining
  const daysA = siteA.sslInfo?.daysRemaining ?? null;
  const daysB = siteB.sslInfo?.daysRemaining ?? null;
  let sslWinner = 'TIE';
  if (daysA !== null && daysB !== null) {
    if (daysA > daysB) { sslWinner = 'A'; pointsA += 1; }
    else if (daysB > daysA) { sslWinner = 'B'; pointsB += 1; }
  } else if (daysA !== null) { sslWinner = 'A'; pointsA += 1; }
  else if (daysB !== null) { sslWinner = 'B'; pointsB += 1; }

  comparisons.push({
    metric: 'ssl',
    label: 'SSL Cert Days Left',
    valA: daysA !== null ? `${daysA} days` : 'N/A',
    valB: daysB !== null ? `${daysB} days` : 'N/A',
    // @ts-ignore
    winner: sslWinner
  });

  // 6. Tech Stack Count
  const stackCountA = siteA.techCount ?? 0;
  const stackCountB = siteB.techCount ?? 0;
  let stackWinner = 'TIE';
  if (stackCountA > stackCountB) { stackWinner = 'A'; pointsA += 1; }
  else if (stackCountB > stackCountA) { stackWinner = 'B'; pointsB += 1; }

  comparisons.push({
    metric: 'stack',
    label: 'Technologies Detected',
    valA: `${stackCountA} tech`,
    valB: `${stackCountB} tech`,
    // @ts-ignore
    winner: stackWinner
  });

  let overallWinner = 'TIE';
  if (pointsA > pointsB) overallWinner = 'A';
  else if (pointsB > pointsA) overallWinner = 'B';

  return {
    siteA,
    siteB,
    comparisons,
    // @ts-ignore
    overallWinner,
    scoreA: pointsA,
    scoreB: pointsB
  };
}
