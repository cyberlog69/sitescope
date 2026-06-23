# 🔍 SiteScope v4 — Instant Website Intelligence & Email Tool

> Paste any URL and get a live preview, metadata, category classification, security threat analysis, and a fully isolated sandbox. Now featuring a dark cosmic glassmorphic UI, bulk checking, and a comprehensive email validator. No signup required.

![SiteScope](https://img.shields.io/badge/SiteScope-v4.0-7c3aed?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![No Build](https://img.shields.io/badge/No%20Build%20Required-✓-06b6d4?style=for-the-badge)
![No Signup](https://img.shields.io/badge/No%20Signup-✓-ec4899?style=for-the-badge)

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🎨 **SiteScope v4 Redesign** | New dark cosmic theme, glassmorphic panels, animated gradient mesh, and neon accents. |
| 📧 **Email & Scam Validator** | Complete RFC 5322 validation, MX lookup, 400+ disposable domain checks, and heuristic scam scoring. |
| 🖼️ **Screenshot Preview** | Server-rendered screenshot via Microlink API. |
| 🛡️ **Isolated Sandbox** | Sanitized HTML rendered safely — scripts & trackers stripped. |
| ⚠️ **Live Frame** | Raw iframe (full JS, clearly marked as unprotected). |
| 🏷️ **Site Category Engine** | AI-style classification into 18+ precision categories (now including dedicated Provider and Insurance portals). |
| 🔐 **Security Scanner** | 2-stage threat detection: heuristics + URLhaus malware DB. |
| 📋 **Bulk Check** | Check up to 25 URLs at once with live progress. |
| 📊 **CSV Export** | Download full bulk results as a `.csv` file. |

---

## 📧 Email Validator & Scam Checker *(New)*

Verify email addresses instantly without sending a message. The tool checks for formatting, deliverability, and flags potential scam or throwaway addresses.

1. **RFC 5322 Syntax Check**: Strict regex validation for correct formatting.
2. **Disposable/Temporary Domain Check**: Flags over 400 known disposable email providers (Mailinator, 10minutemail, etc.).
3. **MX Record Lookup**: Verifies that the domain has valid mail servers configured (via Google DNS over HTTPS).
4. **Heuristic Scam Scoring**: 
   - Flags suspicious usernames (`admin`, `billing`, `support`, `noreply`).
   - Penalizes long strings of numbers or high-entropy random characters in the local part.
   - Outputs a clear Risk Score (🟢 Safe, 🟡 Low, 🟠 Medium, 🔴 High).

---

## 🛡️ Isolated Sandbox Container

The Sandbox tab is the safest way to visually inspect any website. Instead of loading the raw site (which runs JavaScript and can track you), SiteScope:

1. **Fetches** the page HTML through a free CORS proxy (`allorigins.win`) — your browser never contacts the target site directly.
2. **Sanitizes** the HTML through a 10-layer protection pipeline.
3. **Renders** only the cleaned HTML in a maximally-restricted `<iframe>`.

### 10-Layer Sanitization Pipeline

| Layer | What's Removed / Blocked |
|:---:|---|
| 1 | All `<script>` and `<noscript>` tags |
| 2 | Embedded frames: `<iframe>`, `<frame>`, `<object>`, `<embed>`, `<applet>` |
| 3 | Meta redirect tags (`<meta http-equiv="refresh">`) |
| 4 | Existing `<base>` tags (replaced with our own for correct asset resolution) |
| 5 | 30+ known tracker & analytics domains (Google Analytics, Facebook Pixel, etc.) |
| 6 | 50+ inline event handlers (`onclick`, `onload`, `onerror`, `onmouseover`, etc.) |
| 7 | `javascript:` and `vbscript:` URL schemes |
| 8 | All `<form>` submissions (action set to void, submit buttons disabled) |
| 9 | A safe `<base href="...">` injected to resolve relative URLs correctly |
| 10 | Strict CSP `<meta>` tag injected (`script-src 'none'`, `form-action 'none'`) |

---

## 🔐 Security Scanner

Every site check automatically triggers a 2-stage security scan.

### Stage 1 — Heuristic Analysis *(instant, client-side)*
Scores based on factors like: HTTP vs HTTPS, raw IP addresses, suspicious TLDs (`.tk`, `.xyz`), Punycode (homograph attacks), excessively long URLs, phishing keywords in the path, executable extensions, and typosquatting against major brands.

### Stage 2 — URLhaus Threat Database *(async, free, no API key)*
Checks the URL against [URLhaus by abuse.ch](https://urlhaus.abuse.ch/) — a continuously updated database of active malware and phishing URLs.

---

## 🏷️ Precision Site Classification Engine

Classifies any website using a 7-layer scoring system based on TLDs, known domains, subdomain tokens, and weighted keywords. **Updated in v4** to highly distinguish between general healthcare, insurance providers, and B2B medical portals.

### Categories

| Emoji | Category | Example Sites |
|:---:|---|---|
| 🏛️ | Government | whitehouse.gov, europa.eu |
| 🎖️ | Military / Defense | army.mil, nato.int |
| 🎓 | Education | coursera.org, mit.edu |
| 🏥 | Healthcare & Medical | webmd.com, mayoclinic.org |
| 🛡️ | Health Insurance & Payer | aetna.com, cigna.com, bcbs.com |
| 🪪 | Provider Portal | caqh.org, availity.com, epic.com |
| 🏢 | Business / Enterprise Portal | salesforce.com, workday.com |
| 💰 | Finance & Banking | bloomberg.com, stripe.com |
| 🛒 | E-Commerce / Shopping | amazon.com, shopify.com |
| 📱 | Social Media | twitter.com, instagram.com |
| 💻 | Technology & Software | github.com, vercel.com |
| 📰 | News & Media | bbc.com, reuters.com |
| 🎮 | Gaming | steampowered.com, epicgames.com |
| 🎬 | Entertainment & Streaming | netflix.com, spotify.com |
| 📚 | Reference & Encyclopedia | wikipedia.org, britannica.com |
| 🎨 | Design & Creative | figma.com, dribbble.com |
| ✈️ | Travel & Tourism | booking.com, airbnb.com |
| 🍕 | Food & Lifestyle | allrecipes.com, doordash.com |

---

## 📋 Bulk Check Mode

Check up to 25 URLs in one run.

1. Click **Bulk Check** in the mode toggle.
2. Paste up to 25 URLs (one per line or comma-separated).
3. Click **Run Bulk Check** (results fill in live row by row).
4. Click **Export CSV** to download results.
5. Click **Inspect** on any row to run a full single-site analysis on it.

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| HTML + Vanilla CSS & JS | Core app — zero dependencies, no build step |
| [Microlink API](https://microlink.io) | Screenshots & metadata (free tier) |
| [allorigins.win](https://allorigins.win) | CORS proxy for sandbox HTML fetching (free) |
| [URLhaus API](https://urlhaus.abuse.ch) | Malware / phishing URL database (free) |
| [Google DoH](https://dns.google/resolve) | DNS over HTTPS for MX Record lookups |
| Google Fonts | Inter + Space Grotesk |

---

## 🚀 Getting Started

Just open `index.html` in any modern browser — **no server, no install, no signup needed**.

### Local Hosting (Optional)
If you prefer to run it via a local development server, we've provided a simple batch script:
1. Double click `start-local.bat` (or run `python -m http.server 8000` manually).
2. Open your browser to `http://localhost:8000`.

Alternatively, you can use Node.js: `npx serve`.

```text
Website Checker/
├── index.html       ← App structure & all UI
├── style.css        ← Dark glassmorphism design system (v4)
├── app.js           ← All logic: classifier, email validator, security scanner, sandbox
├── start-local.bat  ← Local Python HTTP server script
└── README.md
```

---

## 🌍 Internet Hosting & Deployment

Because SiteScope is a 100% static application (HTML, CSS, JS) with no backend database, it is extremely simple to deploy globally for free.

### GitHub Pages (Recommended)
Since the code is already on GitHub, this is the easiest zero-cost option:
1. Go to your repository settings on GitHub.
2. Click on **Pages** in the left sidebar.
3. Under "Build and deployment", select `Deploy from a branch`.
4. Choose the `master` branch and `/ (root)` folder, then click **Save**.
5. Your site will be live globally within 2 minutes!

### Vercel or Netlify
For a more advanced CDN, PR previews, and custom domain linking:
1. Sign up to [Vercel](https://vercel.com/) or [Netlify](https://netlify.com/) with your GitHub account.
2. Import the `cyberlog69/sitescope` repository.
3. Click **Deploy**. The platform will instantly serve your site globally for free.

---

## ⚠️ Notes & Limitations

| Limitation | Details |
|---|---|
| Sandbox proxy | `allorigins.win` is a free service — may be slow or rate-limited for some sites |
| Screenshot availability | Microlink free tier may not capture all sites |
| URLhaus DB | Checks active/recent threats; historical or new threats may not appear |
| Bulk rate limit | 600ms delay between requests to respect Microlink's free tier |
| DNS Lookups | MX record queries rely on Google's public DoH API |

---

## 🔗 Repository

**GitHub:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

*Built with ❤️ using SiteScope v4 · Preview powered by [Microlink](https://microlink.io) · Threat data by [URLhaus](https://urlhaus.abuse.ch)*
