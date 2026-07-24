# 🔍 SiteScope v4 — Instant Website Intelligence & Security Sandbox

> A blazing-fast, installable Progressive Web App (PWA) that delivers instant website previews, deep metadata extraction, AI-style category classification, multi-layer security threat analysis, a composite **Security Grade Scorecard (A+ to F)**, a fully isolated sandbox, diagnostic report exports (JSON/MD/PDF), and a real-time **Down Detector** powered by official status APIs — all from a single URL. No signup required. No backend. Hosted globally on Vercel.

![SiteScope](https://img.shields.io/badge/SiteScope-v4.0-7c3aed?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-06b6d4?style=for-the-badge)
![Vite](https://img.shields.io/badge/Build-Vite%208-f59e0b?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-120%20Passed-22c55e?style=for-the-badge&logo=vitest)
![Security Hardened](https://img.shields.io/badge/Security-Hardened-ef4444?style=for-the-badge)

🌐 **Live:** [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app) &nbsp;|&nbsp; 📂 **Repo:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🎨 **Cosmic UI** | Dark cosmic theme, glassmorphic panels, animated gradient mesh, and neon accents with GPU-accelerated rendering. |
| 📱 **PWA Ready** | Installable as a standalone app on desktop and mobile. Hardened Service Worker with stale-while-revalidate caching and 5 MB cache cap. |
| ☁️ **Cloud & Local History** | Recent scans are synchronized across sessions via `kvdb.io` with instant `localStorage` fallbacks. |
| 🛡️ **Security Scorecard (A+ to F)** | Composite security grade evaluation assessing HTTPS, HSTS, CSP, X-Frame-Options, SSL validity, and threat status with an owner remediation checklist. |
| 🔍 **Typosquatting Detector** | Advanced homoglyph character substitution (`0`➔`o`, `1`➔`l`) and Levenshtein brand impersonation analysis. |
| 🖼️ **Screenshot Waterfall** | Three-provider fallback chain (WordPress mShots → Thum.io → Microlink embed) fires immediately for instant sandboxed page previews — no API key needed. |
| 🏷️ **21-Category Classifier** | Keyword + TLD + domain scoring across 21 categories: Government, Military, Education, Healthcare, Finance, E-Commerce, Social Media, Technology, AI/ML, News, Gaming, Entertainment, Cybersecurity, and more. |
| 🛡️ **Isolated Sandbox** | Sanitized HTML rendered safely — scripts, trackers, iframes, and malicious embedded elements stripped by a 10-layer DOM pipeline before blob rendering. |
| 🔗 **Link Extractor** | Automatically extracts and lists all hyperlinks found on the target page during the sandbox phase. |
| 🌐 **Advanced Intel** | RDAP-based WHOIS lookups, real-time IP & Location mapping, and HTTP Security Header analysis. All results sanitized against XSS. |
| 📄 **Report Exporter** | One-click export for single site scans into **JSON**, formatted **Markdown (.md)**, or a clean printable **PDF** summary layout. |
| ⚡ **3-Tier CORS Proxy** | Failover CORS proxy engine (`allorigins.win` → `corsproxy.io` → `codetabs.com`) ensures 100% network probe reliability. |
| 📧 **Email Validator** | Complete RFC 5322 validation, MX record lookup, 400+ disposable domain list, and heuristic scam scoring with bulk CSV export. |
| 🔐 **Security Scanner** | 2-stage threat detection: local heuristic scan + URLhaus malware database integration with risk score and findings report. |
| 📋 **Bulk URL Check** | Check up to 25 URLs concurrently with live progress, threat-level filtering, sortable columns, and CSV export. |
| 📡 **Down Detector** | Real-time outage detection using official Statuspage APIs + DNS-over-HTTPS. Live 3×3 service matrix, 24-hour outage chart, and community reporting. |
| 📱 **QR Generator** | One-click QR code generation and PNG download for any scanned URL. |

---

## 🛡️ Composite Security Grade Scorecard (A+ to F)

SiteScope evaluates multi-layer security signals and calculates a composite **Security Grade (`A+`, `A`, `B`, `C`, `D`, `F`)**:

```
                       Scorecard Signals Evaluated
  ┌──────────────────────────────────────────────────────────────────┐
  │  1. Protocol Encryption (HTTPS vs unencrypted HTTP)             │
  │  2. Threat Database Status (URLhaus & Heuristic Threats)         │
  │  3. Typosquatting / Homoglyph Brand Impersonation Status        │
  │  4. HTTP Security Headers (HSTS, CSP, X-Frame-Options, Referrer) │
  │  5. SSL/TLS Certificate Validity & Days Remaining               │
  └──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
             Composite Score (0–100) ➔ Letter Grade (A+ to F)
                                   │
                                   ▼
            Renders Badge on Verdict Card + Remediation Checklist
```

### Remediation Checklist for Site Owners
When security weaknesses are detected (e.g., missing HSTS or expiring SSL), SiteScope generates a prioritized action list with severity ratings (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) so domain owners can quickly fix configuration gaps.

---

## 📄 Diagnostic Report Exporter (JSON / MD / PDF)

Single URL scan results can be exported with 1 click using the **Export** dropdown button next to the QR Code button:
- 📦 **JSON Format**: Raw diagnostic payload containing security scorecard, WHOIS, headers, and metadata.
- 📝 **Markdown (.md)**: Clean formatted audit summary suitable for GitHub issues or security documentation.
- 🖨️ **Print / PDF**: Styled printable report view.

---

## ⚡ 3-Tier CORS Fallback Proxy Engine

Cross-origin network requests (WHOIS, HTTP headers, sandbox HTML fetching) pass through a 3-tier failover proxy pipeline:
1. `api.allorigins.win` (Primary JSON wrapper)
2. `corsproxy.io` (Secondary fast pass-through)
3. `api.codetabs.com` (Tertiary fallback)

If any proxy experiences a temporary outage, SiteScope automatically fails over to the next proxy in the chain without failing the scan.

---

## 📡 Down Detector & Status Monitor

SiteScope includes a dedicated **Down Detector** tab that accurately reports whether any website is up, down, or degraded:

### Dual-source architecture

```
User enters a URL or clicks a popular service card
          │
          ├──► Known service with official status page?
          │         YES → Query Atlassian Statuspage API v2
          │               github.com       → githubstatus.com/api/v2/status.json
          │               openai.com       → status.openai.com/api/v2/status.json
          │               discord.com      → discordstatus.com/api/v2/status.json
          │               cloudflare.com   → cloudflarestatus.com/api/v2/status.json
          │
          └──► All other URLs
                    → DNS-over-HTTPS (dns.google/resolve?name=domain&type=A)
                    → 3-tier CORS proxy reachability check
                    → Direct no-cors HEAD probe
                    → Majority-vote verdict
```

---

## 🖼️ Website Preview System

SiteScope uses a **three-provider screenshot waterfall** that starts the moment you press Check — no waiting on a single slow API:

```
URL entered
    │
    ├──► Screenshot waterfall starts INSTANTLY
    │         1. WordPress mShots  ← free, no API key, industry-standard
    │         2. Thum.io           ← free fallback, no API key
    │         3. Microlink embed   ← last resort
    │
    ├──► Microlink metadata fetch (title, desc, tags) ──┐
    │                                                    ├── Promise.allSettled()
    └──► CORS proxy reachability probe ──────────────────┘
                                                         │
                                         Both done → update badge + intel panels
```

---

## 🏷️ Site Classification Engine v2

SiteScope uses a multi-layer scoring system to classify any URL into one of **21 categories**:

| Layer | Signal | Score Bonus |
|---|---|---|
| 1 | TLD match (`.gov`, `.edu`, `.mil`, `.ac.uk`) | +80 |
| 2 | Known domain match (from curated 500+ domain list) | +60 |
| 3 | Subdomain / path keywords | +25 each (max 2) |
| 4 | Multi-word keyword match | variable (6–36) |
| 5 | Negative keyword penalties | –12 each |
| 6 | `requireDomain` gate | Social Media only wins if domain known |
| 7 | `minScore` threshold | Prevents weak matches from winning |

---

## 🛡️ Isolated Sandbox Container

The **Sandbox tab** is the safest way to visually inspect any website without running its JavaScript or allowing trackers:

1. **Fetch** — Page HTML is retrieved via 3-tier CORS proxy chain.
2. **Sanitize** — Raw HTML passes through a 10-layer DOM protection pipeline:
   - Strips all `<script>` tags and `javascript:` hrefs
   - Removes all inline event handlers (`onclick`, `onload`, etc.)
   - Disables `<iframe>` embeds
   - Blocks `<meta http-equiv="refresh">` redirects
   - Rewrites relative URLs to absolute for correct rendering
   - Removes tracking pixels and analytics snippets
3. **Render** — Cleaned HTML is injected into a maximally-restricted `<iframe>` via a `blob:` URL with `referrerpolicy="no-referrer"`.

---

## 🛠️ Architecture & Tech Stack

| Tool / Service | Purpose |
|---|---|
| **Vite 8** | Build system, module bundler, HMR dev server (0 vulnerabilities) |
| **ES Modules** | Modular architecture (`src/main.js`, `src/modules/scorecard.js`, etc.) |
| **Vitest** | Unit test framework with 120 passing unit tests (`npm test`) |
| **ESLint 10 & Prettier** | Code quality enforcement (`npm run lint`, `npm run format`) |
| **Service Worker** | Hardened PWA caching with stale-while-revalidate (`public/sw.js`) |
| **vercel.json** | Server-level HTTP security headers for the Vercel deployment |
| **kvdb.io & localStorage** | Hybrid cloud + local storage for scan history persistence |
| **CORS Proxies** | 3-tier fallback chain (`allorigins.win`, `corsproxy.io`, `codetabs`) |
| **RDAP (rdap.org)** | Standards-based WHOIS/domain registration data |
| **URLhaus API** | Malware and phishing URL threat database |
| **Google DNS-over-HTTPS** | `dns.google/resolve` — DNS resolution for Down Detector and DNS intel |
| **Atlassian Statuspage API** | Official status feeds for GitHub, OpenAI, Discord, Cloudflare |

---

## 🗂️ Project Structure

```
sitescope/
├── index.html              # Main app shell (all views: Single, Bulk, Email, History, Detector)
├── style.css               # Global styles — cosmic theme, glassmorphism, Scorecard badges
├── src/
│   ├── main.js             # App controller — DOM wiring, event binding, all view controllers
│   ├── intel.js            # WHOIS & HTTP header fetchers
│   ├── main/
│   │   ├── history.js      # Scan history: kvdb.io cloud sync + localStorage fallback (unit-tested)
│   │   └── bulk.js         # Bulk URL parsing + per-URL metadata/threat fetch (unit-tested)
│   ├── modules/
│   │   ├── scorecard.js    # Composite Security Grade Scorecard (A+ to F) (unit-tested)
│   │   ├── category.js     # 21-category classification engine (unit-tested)
│   │   ├── security.js     # 2-stage threat scanner + homoglyph typosquatting (unit-tested)
│   │   ├── sandbox.js      # 10-layer DOM sanitisation pipeline (unit-tested)
│   │   ├── email.js        # RFC 5322 validator + scam scorer (unit-tested)
│   │   └── detector.js     # Down Detector — Statuspage APIs, DNS-over-HTTPS (unit-tested)
│   ├── tools/
│   │   ├── exporter.js     # Diagnostic Report Exporter (JSON/MD/PDF) (unit-tested)
│   │   ├── dns.js          # DNS-over-HTTPS multi-record resolver
│   │   ├── ssl.js          # Certificate Transparency (crt.sh) inspector
│   │   ├── stack.js        # Technology fingerprinting (unit-tested)
│   │   ├── robots.js       # robots.txt fetcher + parser (unit-tested)
│   │   └── latency.js      # 5-probe HEAD latency suite
│   └── utils/
│       ├── helpers.js      # escapeHtml, normalizeUrl, getDomain, sleep, safeHref (unit-tested)
│       ├── proxy.js        # 3-tier CORS proxy fallback chain (allorigins → corsproxy → codetabs)
│       └── logger.js       # Thin console wrapper (logWarn/logError)
├── public/
│   ├── sw.js               # Hardened Service Worker
│   └── manifest.json       # PWA manifest
├── .github/workflows/
│   └── ci.yml              # Lint + typecheck + test + build on every push/PR
├── start-local.bat         # One-click local dev server (Windows)
├── Dockerfile              # Multi-stage Docker build (Node → Nginx)
├── nginx.conf              # Nginx config with security headers for Docker
└── vercel.json             # Vercel deployment config + HTTP security headers
```

---

## 🚀 Getting Started (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/cyberlog69/sitescope.git
cd sitescope

# 2. Install dependencies
npm install

# 3. Run unit tests
npm test

# 4. Start the development server
npm run dev
# → App available at http://localhost:5173

# 5. Build for production
npm run build
```

**Windows shortcut:** Double-click **`start-local.bat`** in the project root — launches the Vite dev server automatically.

---

## 🌍 Deployment Options

SiteScope is a **100% static Vite PWA** — no backend, no database, no server-side code. Deploy anywhere for free.

### ▲ Vercel *(Current live deployment — Recommended)*

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New Project** → Import `cyberlog69/sitescope`.
3. Vercel auto-detects Vite — no settings needed.
4. The `vercel.json` in the repo automatically applies all HTTP security headers.
5. Click **Deploy**. Live globally in ~30 seconds.

> **Auto-deploy:** Every `git push` to `master` triggers a fresh deployment automatically.

**Live URL:** [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app)

---

### 🟦 Netlify

1. Sign up at [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
2. Connect GitHub, select `cyberlog69/sitescope`.
3. Build command: `npm run build` · Publish directory: `dist`
4. Click **Deploy site**.

> Add a `netlify.toml` to replicate security headers from `vercel.json`.

---

### 🐙 GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [master]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

> **Note:** GitHub Pages doesn't support custom HTTP headers — security headers from `vercel.json` won't apply.

---

### 🔷 Cloudflare Pages

1. **Pages → Create a project** → connect GitHub → select `sitescope`.
2. Framework preset: **Vite** · Build command: `npm run build` · Output: `dist`
3. Click **Save and Deploy**.

> Add a `public/_headers` file to apply security headers.

---

### 🐳 Docker

```bash
# Build
docker build -t sitescope:latest .

# Run (served by Nginx on port 8080)
docker run -d -p 8080:80 --name sitescope sitescope:latest
```

Multi-stage build: Node 20 Alpine compiles the Vite app → Nginx Alpine serves the static output. Custom `nginx.conf` mirrors all production security headers (CSP, HSTS, XSS protection).

---

### ☁️ Deployment Comparison

| Platform | Free Tier | Auto-Deploy | Security Headers | Custom Domain | Edge CDN |
|---|---|---|---|---|---|
| **Vercel** *(current)* | ✅ Unlimited | ✅ | ✅ via `vercel.json` | ✅ | ✅ Global |
| **Netlify** | ✅ 100GB/mo | ✅ | ✅ via `netlify.toml` | ✅ | ✅ Global |
| **GitHub Pages** | ✅ Unlimited | ✅ | ❌ Limited | ✅ | ✅ Partial |
| **Cloudflare Pages** | ✅ Unlimited | ✅ | ✅ via `_headers` | ✅ | ✅ Best |
| **Azure Static** | ✅ 100GB/mo | ✅ | ✅ via config | ✅ | ✅ Global |
| **AWS Amplify** | ⚠️ Limited | ✅ | ✅ via console | ✅ | ✅ Global |
| **Docker + Nginx** | Self-hosted | Manual | ✅ via `nginx.conf` | ✅ | — |

---

## ⚠️ Notes & Limitations

| Limitation | Details |
|---|---|
| Screenshot Providers | WordPress mShots may take 5–18s for uncached/new sites. Thum.io and Microlink are tried automatically as fallbacks. |
| Sandbox Proxy | 3-tier CORS proxy chain (`allorigins.win`, `corsproxy.io`, `codetabs`). If one is slow or down, fallback occurs automatically. |
| URLhaus DB | Covers active and recent threats. Zero-day or brand-new threats may not yet appear. |
| Bulk Rate Limit | 600ms delay between requests to respect free-tier API limits. |
| Cloud History | History is stored in a public KV bucket — do not enter sensitive or private URLs. |
| RDAP Coverage | `.com`/`.net`/`.org` domains have the best RDAP coverage. Some ccTLDs may fall back to "Unavailable". |
| Down Detector — Services without official APIs | Google, YouTube, Netflix, Amazon, and X do not publish official Statuspage feeds. These are checked via DNS-over-HTTPS + network probes, which are accurate but not authoritative. |
| Down Detector — Community Reports | Outage reports are stored in a shared public KV bucket. Do not use for private domains. |

---

## 🔗 Links

| | |
|---|---|
| 🌐 **Live App** | [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app) |
| 📂 **GitHub** | [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope) |

---

*Built with ❤️ · Threat data by [URLhaus](https://urlhaus.abuse.ch) · WHOIS by [RDAP](https://rdap.org) · Status APIs by [Atlassian Statuspage](https://www.atlassian.com/software/statuspage) · DNS by [Google DoH](https://developers.google.com/speed/public-dns/docs/doh)*
