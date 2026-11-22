// Vercel Web Analytics loader. Kept external so the CSP does not need
// script-src 'unsafe-inline'. Probes the Vercel-injected endpoint first so
// self-hosted deployments (nginx, localhost) do not emit 404 noise.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

(async function load() {
  try {
    const response = await fetch('/_vercel/insights/script.js', { cache: 'no-store' });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !contentType.includes('javascript')) return;
  } catch (error) {
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();
