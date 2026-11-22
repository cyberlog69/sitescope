// Vercel Speed Insights loader. Kept external so the CSP does not need
// script-src 'unsafe-inline'. The endpoint is only present on Vercel, so probe
// it first — otherwise self-hosted builds request a missing script and log a
// 404 (and nginx SPA fallback would serve HTML as JavaScript).
(async function load() {
  try {
    const response = await fetch('/_vercel/speed-insights/script.js', { cache: 'no-store' });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !contentType.includes('javascript')) return;
  } catch (error) {
    return;
  }

  const { injectSpeedInsights } = await import(
    'https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2/dist/index.mjs'
  );
  injectSpeedInsights();
})();
