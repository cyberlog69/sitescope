# Changelog

All notable changes to SiteScope are documented in this file.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Phase 1: Deep Security & Infrastructure Hardening module (`src/tools/deepSecurity.js`): AST-based Content Security Policy (CSP) parser, RFC 6797 HSTS Preload readiness verification, cookie attribute security hygiene (Secure, HttpOnly, SameSite), non-intrusive sensitive file leak probes (`.env`, `.git/HEAD`, `wp-config.php.bak`, `server-status`), and 1-click hardened configuration snippet generator for Nginx, Apache, Vercel, and Caddy.
- 15 unit tests in `src/tools/deepSecurity.test.js` covering CSP AST analysis, HSTS preload validation, cookie auditing, sensitive leak mock tests, and server config generators.
- Shared `src/utils/helpers.js` (escapeHtml, normalizeUrl, getDomain, sleep, safeHref), removing duplicated logic from 6 files.
- ESLint (flat config) + Prettier + Vitest tooling with `lint`, `format`, `test`, `test:watch`, `typecheck` npm scripts.
- JSDoc type annotations + `tsconfig.json` (`checkJs`) across `src/modules`, `src/tools`, `src/main`, **`src/main.js`**, and `src/intel.js` — `tsc --noEmit` passes with 0 errors.
- `src/main/history.js` and `src/main/bulk.js` — extracted scan-history and bulk-checker logic out of `main.js` so it can be unit tested without a DOM.
- `src/utils/proxy.js` — CORS proxy fallback chain (allorigins `/get` → `/raw` → codetabs) so a single dead free proxy no longer breaks SSL/robots.txt/WHOIS/header lookups. The legacy `corsproxy.io` endpoint was removed after it began returning HTTP 403 without a key.
- `src/utils/logger.js` — thin `console` wrapper (`logWarn`/`logError`) used consistently instead of ad-hoc `console.*` calls.
- `config/csp.js` + `scripts/sync-csp.mjs` — one CSP source of truth, synced into `index.html`, `vercel.json`, and `nginx.conf`; `npm run csp:check` fails CI on drift.
- `scripts/generate-dom-map.mjs` + `src/main/dom.js` — generated, typed element references so `main.js` is fully type-checked (`npm run dom:check`).
- `scripts/generate-icons.mjs` — dependency-free PNG icon generator (192/512, maskable, apple-touch) plus `favicon.svg`.
- `src/test/setup.js` — restores jsdom `localStorage` on Node 22+, where the experimental Node global shadows it. `.nvmrc` and `engines.node >= 20.19`.
- 220 unit tests across 30 files, now including `intel.js`, `tools/dns.js`, `tools/ssl.js`, `tools/latency.js`, `utils/logger.js`, per-browser history namespacing, and outage-report normalization.
- GitHub Actions CI (`.github/workflows/ci.yml`) running lint, typecheck, CSP drift, DOM-map drift, test, and build on every push/PR to `master`/`main`.

### Changed
- Cloud history is now namespaced per browser (`history_<random id>`) instead of one shared public kvdb key, so visitors never read or overwrite each other's scans.
- Community outage reports moved to a separate bucket, are normalized (valid timestamps, one per minute, 24h window, 1000-entry cap), and are rate-limited to one report per browser per hour.
- Sandbox HTML fetching, reachability probes, and Domain Duel HTML fetching now use the shared 3-tier proxy chain with explicit timeouts.
- `script-src` no longer allows `'unsafe-inline'`; theme bootstrap, Vercel analytics stub, and Speed Insights loader were moved to `public/*.js`, and inline `onerror` handlers were replaced with one delegated capture listener.
- CSP now permits `https:` images, connections, and frames so OG previews, latency/reachability probes, and the Live preview actually work; the policy is documented in the README.
- The Live (Unsafe) iframe drops `allow-same-origin`, closing the sandbox-escape vector.
- Service worker no longer pre-caches the Vite-hashed `/style.css` (which does not exist in `dist/`), only caches successful 200 responses, falls back to the cached shell for navigations, and is registered in production builds only.
- Nginx now serves `sw.js`/`manifest.json` with correct cache semantics, caches `/assets/` immutably, and enables gzip.
- `package.json` metadata corrected (name `sitescope`, version 4.4.0, MIT license, no bogus `main: app.js`, Node engines, new maintenance scripts).

### Fixed
- Real variable-scoping bug in `security.js` (`spoofedBrand` was declared inside an `if` block but referenced outside it).
- Service worker install failure in production (`/style.css` pre-cache) and a ternary-precedence bug that cached non-200 responses. Navigations are now network-first so a fresh deploy cannot point at deleted hashed bundles.
- Domain Duel never fetched page HTML, treated the latency number array as `{ok, latencyMs}` objects, and passed raw crt.sh arrays into the scorecard — stack detection, latency, and SSL scoring were permanently wrong.
- Scorecard, watchlist monitor, and Domain Duel now consume a real SSL summary (`valid`, `daysRemaining`, `expiresAt`, `issuer`) via `summarizeSslInfo`.
- Deep-security header lookup was called with a full URL instead of the domain.
- ESLint errors across the codebase: empty catch blocks now log via `logWarn`/`logError` instead of silently swallowing errors, `prefer-const` violations, a `no-useless-assignment` in `scanSecurity`, and documented `no-control-regex` false positives (intentional ASCII/RFC-5322 control-character ranges).

## [4.3] - 2026-07-13 — Down Detector & Status Monitor
- Added Down Detector / Status Monitor page: official Statuspage.io API checks for popular services (GitHub, OpenAI, Discord, Cloudflare, etc.) with a DNS-over-HTTPS + CORS-proxy + direct-HEAD majority-vote fallback for all other domains.
- Popular services grid with live background polling, letter-avatar icons with async real-logo upgrade, and outage history chart.
- Community outage reporting backed by kvdb.io with a localStorage fallback.

## [4.2] - 2026-07-10 — Threat Analysis & UI Overhaul
- Shannon-entropy based DGA (Domain Generation Algorithm) detection, brand subdomain-spoofing heuristics, and async DNS SSRF validation in the security scanner.
- Redesigned UI into a premium SaaS dashboard layout with collapsible sidebar and mobile drawer navigation.

## [4.1] - 2026-07-09 — Modularization
- Split the app into feature modules (`category`, `security`, `sandbox`, `email`, `detector`, `tools/*`) instead of one monolithic script.
- Added the Advanced Intelligence panel (WHOIS, HTTP headers, DNS, SSL, tech stack, robots.txt, latency).

## [4.0] - 2026-06-23/24 — v4: Design Refresh & Email Validator
- Cosmic glassmorphic dark UI, bulk site checking, and a comprehensive email scam/disposable-address validator.
- Security hardening: XSS fixes, CSP header, sandboxed iframe form-action lockdown, referrer-leak fix, safe CSV export.
- Vite migration + PWA support (installable, offline app shell via service worker).

## [1.0] - 2026-06 — Initial Release
- Paste-a-URL checker: live preview/screenshot, metadata extraction, 21-category site classification, and a fully isolated sandboxed preview.
