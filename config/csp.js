// @ts-check
// Single source of truth for the Content-Security-Policy.
// `npm run csp:sync` writes this policy into index.html, vercel.json and
// nginx.conf; `npm run csp:check` (run in CI) fails if they drift.
//
// Rationale for the broad https: sources:
//   - SiteScope's job is to contact arbitrary user-supplied hosts (latency
//     probes, reachability checks) and to render arbitrary remote images
//     (OG previews, favicons). An allow-list cannot enumerate those hosts.
//   - Script execution stays locked to 'self' plus the one analytics CDN and
//     no longer allows 'unsafe-inline', which is where CSP actually matters.
//   - frame-ancestors is only sent as a header (browsers ignore it in <meta>).

/** @type {Record<string, string[]>} */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
  'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': ["'self'", 'https:'],
  'frame-src': ['blob:', 'https:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * @param {Record<string, string[]>} directives
 * @returns {string}
 */
function serialize(directives) {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/** Policy for the <meta http-equiv> tag (frame-ancestors is invalid there). */
export const CSP_META = serialize(CSP_DIRECTIVES);

/** Policy for the HTTP header, including frame-ancestors. */
export const CSP_HEADER = serialize({
  ...CSP_DIRECTIVES,
  'frame-ancestors': ["'none'"],
});
