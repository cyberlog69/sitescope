// @ts-check
// sandbox.js — Sandbox Sanitizer & Iframe Loader module

const TRACKER_DOMAINS = [
  'google-analytics.com','googletagmanager.com','doubleclick.net',
  'facebook.com/tr','facebook.net','fbcdn.net','connect.facebook',
  'analytics.yahoo.com','bat.bing.com','scorecardresearch.com',
  'quantserve.com','hotjar.com','mixpanel.com','segment.io',
  'segment.com','amplitude.com','intercom.io','hubspot.com',
  'marketo.net','pardot.com','eloqua.com','mautic','matomo',
  'piwik','newrelic.com','datadog','sentry.io','logrocket.com',
  'fullstory.com','heap.io','crazyegg.com','clicktale','pingdom',
  'cloudflare-static','cdn.cookielaw'
];

/**
 * Sanitize raw HTML for safe sandboxed rendering.
 * Strips scripts, iframes, event handlers, trackers; disables forms; injects CSP + base tag.
 * @param {string} rawHtml
 * @param {string} baseUrl
 * @returns {{ html:string, stats:{scripts:number, forms:number, iframes:number, redirects:number, trackers:number, handlers:number}, links:{text:string, url:string}[] }}
 */
export function sanitizeForSandbox(rawHtml, baseUrl) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(rawHtml, 'text/html');

  const stats = { scripts: 0, forms: 0, iframes: 0, redirects: 0, trackers: 0, handlers: 0 };

  // 1 — Remove all script elements
  doc.querySelectorAll('script, noscript').forEach(el => { stats.scripts++; el.remove(); });

  // 2 — Remove embedded frame/plugin elements
  doc.querySelectorAll('iframe, frame, frameset, object, embed, applet').forEach(el => {
    stats.iframes++; el.remove();
  });

  // 3 — Block meta redirects and X-Frame-Options
  doc.querySelectorAll('meta').forEach(el => {
    const equiv = (el.getAttribute('http-equiv') || '').toLowerCase();
    if (equiv === 'refresh' || equiv === 'x-frame-options' || equiv === 'content-security-policy') {
      stats.redirects++; el.remove();
    }
  });

  // 4 — Remove existing base tags
  doc.querySelectorAll('base').forEach(el => el.remove());

  // 5 — Remove known tracker scripts/pixels
  doc.querySelectorAll('[src],[href],[action],[data-src]').forEach(el => {
    const attrs = ['src','href','action','data-src'];
    attrs.forEach(attr => {
      const val = el.getAttribute(attr) || '';
      const isTracker = TRACKER_DOMAINS.some(t => val.includes(t));
      if (isTracker) { stats.trackers++; el.remove(); }
    });
  });

  // Extracted links
  const extractedLinks = [];
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('javascript:')) {
      try {
        const u = new URL(href, baseUrl);
        extractedLinks.push({ text: a.textContent.trim().substring(0, 50) || href.substring(0, 50), url: u.href });
      } catch {
        // Malformed/unparseable href — skip this link
      }
    }
  });

  // 6 — Strip all inline event handlers (any attribute starting with "on")
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on') || attrName.startsWith('formaction') || attrName.startsWith('xmlns:')) {
        el.removeAttribute(attr.name);
        stats.handlers++;
      }
    });
  });

  // Neutralise unsafe URI schemes (javascript:, vbscript:, data:text/html, etc.)
  doc.querySelectorAll('[href],[src],[action],[formaction],[data],[poster]').forEach(el => {
    ['href','src','action','formaction','data','poster'].forEach(attr => {
      if (!el.hasAttribute(attr)) return;
      const val = (el.getAttribute(attr) || '').trim().toLowerCase();
      if (
        val.startsWith('javascript:') ||
        val.startsWith('vbscript:') ||
        val.startsWith('data:text/html') ||
        val.startsWith('data:text/javascript') ||
        val.startsWith('data:application/javascript')
      ) {
        el.setAttribute(attr, '#');
      }
    });
  });

  // 7 — Disable all forms
  doc.querySelectorAll('form').forEach(form => {
    stats.forms++;
    form.setAttribute('action', 'about:blank');
    form.setAttribute('method', 'get');
    form.querySelectorAll('[type="submit"], button').forEach(btn => btn.setAttribute('disabled', 'true'));
  });

  // 8 — Remove preloads
  doc.querySelectorAll('link[rel="prefetch"], link[rel="prerender"], link[rel="dns-prefetch"]').forEach(el => el.remove());

  // 9 — Inject base tag
  const base    = doc.createElement('base');
  base.href     = baseUrl;
  base.target   = '_blank';
  if (doc.head.firstChild) doc.head.insertBefore(base, doc.head.firstChild);
  else doc.head.appendChild(base);

  // 10 — Inject strict CSP meta
  const csp = doc.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content',
    "default-src * 'unsafe-inline' data: blob:; " +
    "script-src 'none'; " +
    "form-action 'none'; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  );
  doc.head.insertBefore(csp, doc.head.firstChild);

  return { html: doc.documentElement.outerHTML, stats, links: extractedLinks };
}
