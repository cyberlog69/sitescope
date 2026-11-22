# Security Policy

## Supported Versions

SiteScope is a client-side app; only the latest release line receives security
updates.

| Version | Supported          |
| ------- | ------------------ |
| 4.4.x   | :white_check_mark: |
| < 4.4   | :x:                |

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub's
[Security Advisories](https://github.com/cyberlog69/sitescope/security/advisories/new)
rather than opening a public issue. Include:

- A description of the issue and its impact.
- Steps to reproduce (URL/scan if relevant, browser, deployment target).
- Any suggested fix or mitigation.

You can expect an acknowledgement within 72 hours and a status update within
7 days. Please do not disclose the issue publicly until a fix has shipped.

## Security Model

- **No backend.** SiteScope is static files; scanning happens in the browser.
  There are no accounts, cookies for authentication, or server-side secrets.
- **Untrusted input is escaped.** Remote metadata, headers, DNS records, and
  certificate data are rendered with `textContent` or `escapeHtml()`.
- **Content Security Policy.** `script-src` is restricted to `'self'` plus the
  Speed Insights CDN and does **not** allow `'unsafe-inline'`. `img-src`,
  `connect-src`, and `frame-src` allow `https:` because the product must contact
  arbitrary user-supplied hosts and render arbitrary remote images. The policy
  lives in `config/csp.js` and is kept in sync with `index.html`,
  `vercel.json`, and `nginx.conf` by `npm run csp:sync`.
- **Sandboxing.** Sanitized previews run in a `blob:` iframe with
  `sandbox="allow-same-origin"` (no scripts/forms). The Live preview allows
  scripts but omits `allow-same-origin`, preventing access to the parent app.
- **Public third-party services.** CORS proxies, `kvdb.io`, crt.sh, URLhaus,
  Microlink, and status APIs receive the URLs you scan. Do not scan private or
  sensitive URLs if that is a concern.
- **Cloud history** is namespaced per browser with a random 128-bit id, but the
  backing bucket is public and managed by a third party.
