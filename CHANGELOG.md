# Changelog

All notable changes to SiteScope are documented in this file.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Shared `src/utils/helpers.js` (escapeHtml, normalizeUrl, getDomain, sleep, safeHref), removing duplicated logic from 6 files.
- ESLint (flat config) + Prettier + Vitest tooling with `lint`, `format`, `test`, `test:watch`, `typecheck` npm scripts.
- JSDoc type annotations + `tsconfig.json` (`checkJs`) across `src/modules`, `src/tools`, `src/main`, and `src/intel.js` — `tsc --noEmit` passes with 0 errors.
- `src/main/history.js` and `src/main/bulk.js` — extracted scan-history (cloud+local sync) and bulk-checker logic out of `main.js` so it can be unit tested without a DOM.
- `src/utils/proxy.js` — CORS proxy fallback chain (allorigins → codetabs) so a single dead free proxy no longer breaks SSL/robots.txt/WHOIS/header lookups.
- `src/utils/logger.js` — thin `console` wrapper (`logWarn`/`logError`) used consistently instead of ad-hoc `console.*` calls.
- 115 unit tests across 11 test files (up from 59/5), covering security heuristics, email scam scoring, sandbox sanitization, category classification, down-detector helpers, tech-stack fingerprinting, robots.txt parsing, scan history merge/sync, bulk URL parsing, and the CORS proxy fallback.
- GitHub Actions CI (`.github/workflows/ci.yml`) running lint, typecheck, test, and build on every push/PR to `main`.

### Fixed
- Real variable-scoping bug in `security.js` (`spoofedBrand` was declared inside an `if` block but referenced outside it).
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
