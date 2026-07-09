# 🔍 SiteScope v4 — Instant Website Intelligence & Security Sandbox

> A blazing-fast, installable Progressive Web App (PWA) that delivers instant website previews, deep metadata extraction, AI-style category classification, multi-layer security threat analysis, and a fully isolated sandbox — all from a single URL. No signup required. No backend. Hosted globally on Vercel.

![SiteScope](https://img.shields.io/badge/SiteScope-v4.0-7c3aed?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-06b6d4?style=for-the-badge)
![Vite](https://img.shields.io/badge/Build-Vite%208-f59e0b?style=for-the-badge)
![No Signup](https://img.shields.io/badge/No%20Signup-✓-ec4899?style=for-the-badge)
![Security Hardened](https://img.shields.io/badge/Security-Hardened-ef4444?style=for-the-badge)

🌐 **Live:** [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app) &nbsp;|&nbsp; 📂 **Repo:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🎨 **Cosmic UI** | Dark cosmic theme, glassmorphic panels, animated gradient mesh, and neon accents with GPU-accelerated rendering. |
| 📱 **PWA Ready** | Installable as a standalone app on desktop and mobile. Hardened Service Worker with stale-while-revalidate caching and 5 MB cache cap. |
| ☁️ **Cloud History** | Recent scans are pushed to a lightweight cloud endpoint (kvdb.io) and synchronized across your session. |
| 🖼️ **Screenshot Waterfall** | Three-provider fallback chain (WordPress mShots → Thum.io → Microlink embed) fires immediately for instant sandboxed page previews — no API key needed. |
| 🏷️ **21-Category Classifier** | Keyword + TLD + domain scoring across 21 categories: Government, Military, Education, Healthcare, Insurance, Provider Portal, Finance, E-Commerce, Social Media, Technology, AI/ML, News, Gaming, Entertainment, Reference, Design, Travel, Food, Sports, Real Estate, Legal, Cybersecurity, and Automotive. |
| 🛡️ **Isolated Sandbox** | Sanitized HTML rendered safely — scripts, trackers, iframes, and malicious embedded elements stripped by a 10-layer DOM pipeline before blob rendering. |
| 🔗 **Link Extractor** | Automatically extracts and lists all hyperlinks found on the target page during the sandbox phase. |
| 🌐 **Advanced Intel** | RDAP-based WHOIS lookups, real-time IP & Location mapping, and HTTP Security Header analysis. All results sanitized against XSS. |
| 📧 **Email Validator** | Complete RFC 5322 validation, MX record lookup, 400+ disposable domain list, and heuristic scam scoring with bulk CSV export. |
| 🔐 **Security Scanner** | 2-stage threat detection: local heuristic scan + URLhaus malware database integration with risk score and findings report. |
| 📋 **Bulk URL Check** | Check up to 25 URLs concurrently with live progress, threat-level filtering, sortable columns, and CSV export. |
| 📱 **QR Generator** | One-click QR code generation for any scanned URL. |
| ⚡ **Zero-CPU Rendering** | CSS glassmorphism backgrounds replaced with native `radial-gradient` to eliminate expensive `filter: blur()` composite layers and prevent CPU lockup. |

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
    └──► allorigins reachability probe ─────────────────┘
                                                         │
                                         Both done → update badge + intel panels
```

**Key improvement:** Reachability (`✓ Reachable` badge) is now **independent** from screenshot success. A site will never be marked "Unreachable" simply because a screenshot service failed or timed out.

All screenshot providers are **sandboxed remote renders** — the target site's JavaScript never executes in your browser.

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

**Categories:** Government · Military · Education · Healthcare · Health Insurance · Provider Portal · Business Portal · Finance · E-Commerce · Social Media · Technology · AI & ML · News · Gaming · Entertainment · Reference · Design · Travel · Food · Sports · Real Estate · Legal · Cybersecurity · Automotive

---

## 🛡️ Isolated Sandbox Container

The **Sandbox tab** is the safest way to visually inspect any website without running its JavaScript or allowing trackers:

1. **Fetch** — Page HTML is retrieved through `allorigins.win` CORS proxy.
2. **Sanitize** — Raw HTML passes through a 10-layer DOM protection pipeline:
   - Strips all `<script>` tags and `javascript:` hrefs
   - Removes all inline event handlers (`onclick`, `onload`, etc.)
   - Disables `<iframe>` embeds
   - Blocks `<meta http-equiv="refresh">` redirects
   - Rewrites relative URLs to absolute for correct rendering
   - Removes tracking pixels and analytics snippets
3. **Render** — Cleaned HTML is injected into a maximally-restricted `<iframe>` via a `blob:` URL with `referrerpolicy="no-referrer"`.

---

## 🧠 Advanced Network Intelligence (NEXUS Engine)

Every site check automatically resolves multi-layered diagnostic reports under a tabbed intelligence panel:

1. **WHOIS Lookup:** Standards-based domain registration query via RDAP (rate-limit-free) detailing registrar name, creation, and expiration dates.
2. **HTTP Headers:** Surfacing active response headers (`Server`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, etc.) to evaluate server configurations.
3. **DNS Resolver:** Queries all record types (`A`, `AAAA`, `MX`, `TXT`, `CNAME`, `NS`, `SOA`, `CAA`) directly using Google DoH, with verification badges for email security policies (`SPF` & `DMARC`).
4. **SSL/TLS Inspector:** Queries public Certificate Transparency (CT) logs on `crt.sh`, maps Subject Alternative Names (SANs), calculates remaining validity days, and issues a security grade (`A` to `F`).
5. **Technology Stack Detector:** Scans page markup and headers for signature patterns to identify frameworks (React, Next.js, Vue, Angular, jQuery), CMS (WordPress, Shopify, Squarespace, Wix), CDNs/Cloud (Cloudflare, Vercel, Netlify, AWS CloudFront), and analytics tags.
6. **Robots.txt & Sitemap Parser:** Fetches and parses crawl instructions, alerts on sensitive directories exposed to crawlers (like `admin`, `api`, `config`, `.git`), and lists sitemaps.
7. **Latency Probe:** Fires a 5-probe HEAD latency sequence directly to the host using `no-cors` mode, calculating minimum, maximum, average, and 95th percentile (`p95`) connection RTT (Round Trip Time).

> **Security note:** All API data is rendered safely using DOM `textContent` and `createElement()` inputs rather than `innerHTML` blocks, ensuring protection against XSS injections from third-party hosts.

---

## 🔐 Cybersecurity Hardening

SiteScope has been through a full security audit. The following protections are in place:

### HTTP Security Headers (via `vercel.json`)
| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disables camera, mic, geolocation, payment, USB, accelerometer |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy` | Strict allowlist for `img-src`, `connect-src`, `script-src` |

### Application-Level Protections
- **XSS Prevention:** All user/API-derived data goes through `escapeHtml()` before `innerHTML`, or uses `textContent`/`createElement()` directly.
- **`onclick=` XSS eliminated:** History items use safe event delegation with `data-url` attributes — URL strings never execute as code.
- **`javascript:` Protocol blocked:** New `safeHref()` function validates `http://` or `https://` scheme before any URL enters an `href` attribute.
- **URL scheme validation:** Bulk result rows validate URLs before rendering into the DOM.
- **Content Security Policy:** Strict `img-src` allowlist (8 known hosts), full `connect-src` allowlist for all used APIs, `object-src: none`, `base-uri: self`, `form-action: none`, `upgrade-insecure-requests`.
- **Service Worker hardening:** No `console.log` leaks, 5 MB cache cap, stale-while-revalidate, rejects opaque cross-origin responses.

---

## 📧 Email Validator & Scam Checker

Verify email addresses instantly without sending a message:

1. **Syntax Check** — Strict RFC 5322 regex validation.
2. **Disposable Check** — Flags 400+ known disposable providers (Mailinator, 10minutemail, etc.).
3. **MX Lookup** — Verifies the domain has valid mail servers via DNS-over-HTTPS.
4. **Heuristic Scam Scoring** — Flags suspicious usernames, high-entropy strings, and outputs a Risk Score (0–100).
5. **Bulk Mode** — Paste a list of emails, validate all at once, and export to CSV.

---

## 🛠️ Architecture & Tech Stack

| Tool / Service | Purpose |
|---|---|
| **Vite 8** | Build system, module bundler, HMR dev server (0 vulnerabilities) |
| **ES Modules** | Modular architecture (`src/main.js`, `src/intel.js`) |
| **Service Worker** | Hardened PWA caching with stale-while-revalidate (`public/sw.js`) |
| **vercel.json** | Server-level HTTP security headers for the Vercel deployment |
| **kvdb.io** | Stateless cloud KV store for cross-session history |
| **WordPress mShots** | Primary free screenshot provider (no API key) |
| **Thum.io** | Secondary free screenshot provider (no API key) |
| **Microlink API** | Page metadata: title, description, tags, OG image (free tier) |
| **allorigins.win** | CORS proxy for sandbox HTML fetching and API proxying |
| **RDAP (rdap.org)** | Standards-based WHOIS/domain registration data |
| **URLhaus API** | Malware and phishing URL threat database |
| **Google DoH** | DNS-over-HTTPS for IP/A-record resolution |

---

## 🚀 Getting Started (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/cyberlog69/sitescope.git
cd sitescope

# 2. Install dependencies
npm install

# 3. Start the development server (Hot Module Replacement enabled)
npm run dev

# 4. Build for production
npm run build
# → Creates an optimized bundle in dist/
```

---

## 🌍 Internet Hosting & Deployment

SiteScope is a **100% static Vite PWA** — no backend, no database, no server-side code. This makes it trivially easy to deploy anywhere for free.

---

### ▲ Vercel *(Current live deployment — Recommended)*

Vercel offers the best experience for Vite apps: automatic builds, global edge CDN, PR previews, and custom domains.

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New Project** → Import `cyberlog69/sitescope`.
3. Vercel auto-detects Vite — no settings needed.
4. The `vercel.json` in the repo automatically applies all HTTP security headers (HSTS, CSP, X-Frame-Options, etc.).
5. Click **Deploy**. Your app is live globally in ~30 seconds.

> **Auto-deploy:** Every `git push` to `master` triggers a fresh deployment automatically.

**Live URL:** [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app)

---

### 🟦 Netlify

Nearly identical to Vercel — also free, also supports Vite, and offers a generous free tier.

1. Sign up at [netlify.com](https://netlify.com) with your GitHub account.
2. Click **Add new site** → **Import an existing project** → connect GitHub.
3. Select the `cyberlog69/sitescope` repository.
4. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**.

> **Custom Headers:** Create a `netlify.toml` file in the root to replicate the security headers from `vercel.json`:
> ```toml
> [[headers]]
>   for = "/*"
>   [headers.values]
>     X-Frame-Options = "DENY"
>     X-Content-Type-Options = "nosniff"
>     Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
>     Referrer-Policy = "strict-origin-when-cross-origin"
> ```

---

### 🐙 GitHub Pages

Free hosting directly from your GitHub repository — no third-party account needed.

1. Push the code to your GitHub repository.
2. Go to **Settings → Pages** in your repo.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Create `.github/workflows/deploy.yml`:

```yaml
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

5. Push this file and GitHub will build and deploy automatically.

> **Note:** GitHub Pages doesn't support custom HTTP headers — the security headers from `vercel.json` won't apply. Use Vercel or Netlify for full security header support.

---

### 🔷 Cloudflare Pages

Cloudflare Pages provides a global CDN with unlimited bandwidth and excellent performance.

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages → Create a project**.
2. Connect your GitHub account and select the `sitescope` repository.
3. Set build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**.

> **Security Headers:** Add headers via a `_headers` file in the `public/` directory:
> ```
> /*
>   X-Frame-Options: DENY
>   X-Content-Type-Options: nosniff
>   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
>   Referrer-Policy: strict-origin-when-cross-origin
> ```

---

### 🔵 Azure Static Web Apps

Deploy to Microsoft Azure's global static hosting platform.

1. Go to [portal.azure.com](https://portal.azure.com) → **Create a resource → Static Web App**.
2. Connect your GitHub account and select the `sitescope` repository.
3. Set build details:
   - **App location:** `/`
   - **Output location:** `dist`
   - **Build command:** `npm run build`
4. Click **Review + Create → Create**.
5. Azure automatically creates a GitHub Actions workflow for CI/CD.

---

### 🟠 AWS Amplify

Deploy to Amazon Web Services using their managed static hosting.

1. Go to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/).
2. Click **New app → Host web app → GitHub**.
3. Select the `cyberlog69/sitescope` repository and branch `master`.
4. Amplify detects Vite automatically. Confirm the build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
5. Click **Save and deploy**.

---

### 🖥️ Local Development Server

To run SiteScope on your own machine:

```bash
# Clone the repository
git clone https://github.com/cyberlog69/sitescope.git
cd sitescope

# Install dependencies
npm install

# Start local dev server with Hot Module Replacement
npm run dev
# → App available at http://localhost:5173

# Build for production
npm run build
# → Optimized bundle in dist/

# Preview the production build locally
npm run preview
# → Serves dist/ at http://localhost:4173
```

Alternatively, double-click **`start-local.bat`** in the project root for a one-click local start.

---

### ☁️ Deployment Comparison

| Platform | Free Tier | Auto-Deploy | Security Headers | Custom Domain | Edge CDN |
|---|---|---|---|---|---|
| **Vercel** *(current)* | ✅ Unlimited | ✅ | ✅ via `vercel.json` | ✅ | ✅ Global |
| **Netlify** | ✅ 100GB/mo | ✅ | ✅ via `netlify.toml` | ✅ | ✅ Global |
| **GitHub Pages** | ✅ Unlimited | ✅ | ❌ Limited | ✅ | ✅ Partial |
| **Cloudflare Pages** | ✅ Unlimited | ✅ | ✅ via `_headers` | ✅ | ✅ Best |
| **Azure Static** | ✅ 100GB/mo | ✅ | ✅ via `staticwebapp.config.json` | ✅ | ✅ Global |
| **AWS Amplify** | ⚠️ Limited | ✅ | ✅ via console | ✅ | ✅ Global |


---

## ⚠️ Notes & Limitations

| Limitation | Details |
|---|---|
| Screenshot Providers | WordPress mShots may take 5–18s for uncached/new sites. Thum.io and Microlink are tried automatically as fallbacks. |
| Sandbox Proxy | `allorigins.win` is a free public service — may occasionally be slow or rate-limited. |
| URLhaus DB | Covers active and recent threats. Zero-day or brand-new threats may not yet appear. |
| Bulk Rate Limit | 600ms delay between requests to respect free-tier API limits. |
| Cloud History | History is stored in a public KV bucket — do not enter sensitive or private URLs. |
| RDAP Coverage | `.com`/`.net`/`.org` domains have the best RDAP coverage. Some ccTLDs may fall back to "Unavailable". |

---

## 🔗 Links

| | |
|---|---|
| 🌐 **Live App** | [sitescope-omega.vercel.app](https://sitescope-omega.vercel.app) |
| 📂 **GitHub** | [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope) |

---

*Built with ❤️ · Preview by [WordPress mShots](https://s0.wordpress.com/mshots/v1/) & [Thum.io](https://image.thum.io) · Metadata by [Microlink](https://microlink.io) · Threat data by [URLhaus](https://urlhaus.abuse.ch) · WHOIS by [RDAP](https://rdap.org)*
