// @ts-check
// latency.js — Multi-Probe Latency Tester Module

/**
 * HEAD-probe a URL once and measure round-trip time in ms.
 * @param {string} url
 * @returns {Promise<number>}
 */
export async function measureLatencySingle(url) {
  const start = performance.now();
  try {
    // Use mode: 'no-cors' to bypass CORS blocks for HEAD requests
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // Rejection or timeouts — latency is still measured (elapsed time to failure)
  }
  return performance.now() - start;
}

/**
 * @param {string} url
 * @param {number} [trialsCount]
 * @returns {Promise<number[]>}
 */
export async function runLatencySuite(url, trialsCount = 5) {
  /** @type {number[]} */
  const trials = [];
  for (let i = 0; i < trialsCount; i++) {
    const time = await measureLatencySingle(url);
    trials.push(Math.round(time));
    // Brief sleep between trials
    await new Promise(r => setTimeout(r, 200));
  }
  return trials;
}

/**
 * @param {number[] | null} trials
 * @param {HTMLElement | null} containerEl
 * @returns {void}
 */
export function renderLatencyPanel(trials, containerEl) {
  if (!containerEl) return;

  if (!trials || !trials.length) {
    containerEl.innerHTML = '<div class="info-value" style="padding:14px;text-align:center;">Latency test unavailable.</div>';
    return;
  }

  const avg = Math.round(trials.reduce((sum, t) => sum + t, 0) / trials.length);

  // Compute 95th percentile (simple interpolation)
  const sorted = [...trials].sort((a, b) => a - b);
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Idx];

  // Build timeline HTML
  const maxTrial = Math.max(...trials, 1);
  const timelineHtml = trials.map((t, idx) => {
    const heightPercent = Math.min(100, (t / maxTrial) * 100);
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:80px;justify-content:flex-end;">
        <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">${t}ms</div>
        <div style="width:16px;height:${heightPercent}%;background:linear-gradient(180deg, var(--violet-2), var(--violet));border-radius:3px 3px 0 0;box-shadow: 0 0 10px var(--violet-glow);"></div>
        <div style="font-size:0.6rem;color:var(--text-dim);margin-top:4px;">#${idx + 1}</div>
      </div>
    `;
  }).join('');

  // Performance status
  let speedStatus = 'Optimal';
  let speedColor = 'var(--green)';
  if (avg > 300) {
    speedStatus = 'Slow Connection';
    speedColor = 'var(--red)';
  } else if (avg > 150) {
    speedStatus = 'Moderate Jitter';
    speedColor = 'var(--yellow)';
  }

  containerEl.innerHTML = `
    <div style="padding:14px;display:flex;gap:14px;border-bottom:1px solid var(--border);justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Performance Grade</div>
        <strong style="color:${speedColor};font-size:1.1rem;font-family:'Space Grotesk',sans-serif;">${speedStatus}</strong>
      </div>
      <div style="display:flex;gap:14px;text-align:right;">
        <div>
          <span style="font-size:0.65rem;color:var(--text-muted);display:block;">Average</span>
          <span style="font-size:0.95rem;font-weight:700;color:var(--text);font-family:monospace;">${avg}ms</span>
        </div>
        <div>
          <span style="font-size:0.65rem;color:var(--text-muted);display:block;">95th%</span>
          <span style="font-size:0.95rem;font-weight:700;color:var(--text);font-family:monospace;">${p95}ms</span>
        </div>
      </div>
    </div>
    
    <div style="padding:14px;">
      <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">Response Timeline (HEAD Probe)</div>
      <div style="display:flex;gap:10px;align-items:flex-end;">
        ${timelineHtml}
      </div>
    </div>
  `;
}
