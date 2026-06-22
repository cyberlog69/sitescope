# 🔍 SiteScope — Instant Website Intelligence Tool

> Paste any URL and get a live preview, metadata, category classification, security threat analysis, and a fully isolated sandbox — all in seconds, no signup required.

![SiteScope](https://img.shields.io/badge/SiteScope-v3.0-6c63ff?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![No Build](https://img.shields.io/badge/No%20Build%20Required-✓-38bdf8?style=for-the-badge)
![No Signup](https://img.shields.io/badge/No%20Signup-✓-a78bfa?style=for-the-badge)

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🖼️ **Screenshot Preview** | Server-rendered screenshot via Microlink API |
| 🛡️ **Isolated Sandbox** | Sanitized HTML rendered safely — scripts & trackers stripped |
| ⚠️ **Live Frame** | Raw iframe (full JS, clearly marked as unprotected) |
| 🏷️ **Site Category** | AI-style classification into 16+ categories |
| 🔐 **Security Scanner** | 2-stage threat detection: heuristics + URLhaus malware DB |
| 📋 **Bulk Check** | Check up to 25 URLs at once with live progress |
| 📊 **CSV Export** | Download full bulk results as a `.csv` file |
| 🔎 **Inspect** | Jump from any bulk row to a full single-site analysis |

---

## 🛡️ Isolated Sandbox Container *(New in v3)*

The Sandbox tab is the safest way to visually inspect any website. Instead of loading the raw site (which runs JavaScript and can track you), SiteScope:

1. **Fetches** the page HTML through a free CORS proxy (`allorigins.win`) — your browser never contacts the target site directly
2. **Sanitizes** the HTML through a 10-layer protection pipeline
3. **Renders** only the cleaned HTML in a maximally-restricted `<iframe>`

### 10-Layer Sanitization Pipeline

| Layer | What's Removed / Blocked |
|:---:|---|
| 1 | All `<script>` and `<noscript>` tags |
| 2 | Embedded frames: `<iframe>`, `<frame>`, `<object>`, `<embed>`, `<applet>` |
| 3 | Meta redirect tags (`<meta http-equiv="refresh">`) |
| 4 | Existing `<base>` tags (replaced with our own for correct asset resolution) |
| 5 | 30+ known tracker & analytics domains (Google Analytics, Facebook Pixel, Hotjar, Mixpanel, Segment, etc.) |
| 6 | 50+ inline event handlers (`onclick`, `onload`, `onerror`, `onmouseover`, etc.) |
| 7 | `javascript:` and `vbscript:` URL schemes |
| 8 | All `<form>` submissions (action set to void, submit buttons disabled) |
| 9 | A safe `<base href="...">` injected to resolve relative URLs correctly |
| 10 | Strict CSP `<meta>` tag injected (`script-src 'none'`, `form-action 'none'`) |

### iframe Restrictions (on top of sanitization)

```
sandbox="allow-same-origin"          ← CSS & images load; NO scripts
referrerpolicy="no-referrer"         ← No referrer headers leaked
allow="camera 'none';
       microphone 'none';
       payment 'none';
       geolocation 'none';
       usb 'none';
       bluetooth 'none'"
```

### What Works vs What's Blocked

| ✅ Still Renders | 🚫 Blocked |
|---|---|
| Page layout & HTML structure | All JavaScript execution |
| CSS styling & animations | Form submissions |
| Images & media | Analytics & tracking pixels |
| Web fonts | Popups & new windows |
| Page text content | Redirects |
| | Camera / Microphone / Geolocation |

### Status Header

After loading, the sandbox header shows:
- **Shield icon** + `Isolated Sandbox Container`
- **✅ Fully isolated — N threats blocked**
- **6 live block-count badges**: Scripts `[12]` · Forms `[3]` · Iframes `[2]` · Redirects `[1]` · Trackers `[8]` · Events `[21]`

---

## 🔐 Security Scanner

Every site check automatically triggers a 2-stage security scan.

### Stage 1 — Heuristic Analysis *(instant, client-side)*

| Signal | Risk Points |
|---|:---:|
| HTTP only (not HTTPS) | +25 |
| Raw IP address in URL | +30 |
| Non-standard port | +20 |
| Suspicious TLD (`.tk`, `.xyz`, `.click`, `.loan`…) | +25 |
| Non-ASCII / Punycode in domain (homograph attack) | +35 |
| `@` symbol before domain (phishing redirect trick) | +30 |
| URL longer than 120 characters | +12 |
| 4+ subdomain segments | +15 |
| Phishing keywords (`login`, `verify`, `account`, `wallet`…) | +8 – +20 |
| Executable file extension (`.exe`, `.apk`, `.bat`…) | +15 |
| Typosquatting detected (Levenshtein ≤ 2 from known brand) | +25 |
| HTTPS bonus | −8 |
| Exact known brand domain match | −15 |

### Stage 2 — URLhaus Threat Database *(async, free, no API key)*

Checks the URL against [URLhaus by abuse.ch](https://urlhaus.abuse.ch/) — a continuously updated database of active malware and phishing URLs.

### Threat Levels

| Score | Level | Action |
|:---:|---|---|
| 0–15 | 🟢 **Safe** | No threats detected |
| 16–30 | 🟡 **Low Risk** | Browse with normal caution |
| 31–50 | 🟠 **Medium Risk** | Verify before sharing credentials |
| 51–70 | 🔴 **High Risk** | Avoid entering any credentials |
| 71–100 | 🚨 **Critical** | Do NOT visit — known or likely malicious |

### What's Shown in the Panel

- Threat level badge with colour-coded glow (pulses red on Critical)
- Risk score bar (0–100) with gradient fill
- Database status dot (🟢 clean / 🔴 malware found / ⚪ unavailable)
- Detailed findings list with icons (✅ good / ⚠️ warn / ❌ danger / ℹ️ info)

---

## 🏷️ Site Classification Engine

Classifies any website into one of 16+ categories using a 7-layer scoring system.

### Categories

| Emoji | Category | Example Sites |
|:---:|---|---|
| 🏛️ | Government | whitehouse.gov, europa.eu |
| 🎖️ | Military / Defense | army.mil, nato.int |
| 🎓 | Education | coursera.org, mit.edu |
| 🏥 | Healthcare & Medical | caqh.org, webmd.com, cigna.com |
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

### Scoring Layers

| Layer | Signal | Points |
|:---:|---|:---:|
| 1 | TLD match — `.gov`, `.edu`, `.mil` | +80 |
| 2 | Known domain list — 200+ curated entries | +60 |
| 3 | Subdomain/path token analysis | +25 each |
| 4 | Variable-weight keyword scoring | variable |
| 5 | Negative keywords — penalise false positives | −12 each |
| 6 | `requireDomain` gate — Social Media only wins with confirmed domain | gate |
| 7 | Confidence display — `✓ High` / `~ Medium` / `? Low` | display |

> **Example:** `https://proview-sit2.nonprod.caqh.org/` → correctly classified as **🏥 Healthcare & Medical** — the subdomain tokens `proview`, `caqh` match healthcare signals and `caqh.org` is in the known domain list.

---

## 📋 Bulk Check Mode

Check up to 25 URLs in one run.

### How to Use

1. Click **Bulk Check** in the mode toggle
2. Paste up to 25 URLs (one per line or comma-separated)
3. Click **Run Bulk Check**
4. Results fill in live row by row
5. Click **Export CSV** to download results
6. Click **Inspect** on any row to run a full single-site analysis on it

### Bulk Results Table Columns

| Column | Description |
|---|---|
| # | Row number |
| Favicon | Site icon |
| URL / Title | Full URL and page title |
| Category | Classified category badge |
| Status | ✅ Reachable / ❌ Failed |
| Threats | 🟢 Safe / 🟡 Low / 🟠 Medium / 🔴 High / 🚨 Critical |
| Description | Meta description |
| Actions | Open · Inspect |

### CSV Export Columns

`#` · `URL` · `Title` · `Category` · `Status` · `Language` · `Description`

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| HTML + CSS + Vanilla JavaScript | Core app — zero dependencies, no build step |
| [Microlink API](https://microlink.io) | Screenshots & metadata (free tier) |
| [allorigins.win](https://allorigins.win) | CORS proxy for sandbox HTML fetching (free, no key) |
| [URLhaus API](https://urlhaus.abuse.ch) | Malware / phishing URL database (free, no key) |
| [Google Favicon Service](https://www.google.com/s2/favicons) | Site icons |
| Google Fonts (Inter + Space Grotesk) | Typography |

---

## 🚀 Getting Started

Just open `index.html` in any modern browser — **no server, no install, no signup needed**.

```
Website Checker/
├── index.html   ← App structure & all UI
├── style.css    ← Dark glassmorphism design system
├── app.js       ← All logic: classifier, security scanner, sandbox, bulk checker
└── README.md
```

---

## ⚠️ Notes & Limitations

| Limitation | Details |
|---|---|
| Sandbox proxy | `allorigins.win` is a free service — may be slow or rate-limited for some sites |
| Screenshot availability | Microlink free tier may not capture all sites |
| URLhaus DB | Checks active/recent threats; historical or new threats may not appear |
| Bulk rate limit | 600ms delay between requests to respect Microlink's free tier |
| Screenshots in bulk | Bulk mode uses metadata-only requests (no screenshots) for speed |
| Live tab | Loads the real site with full JS — use Sandbox tab for safe inspection |

---

## 🔗 Repository

**GitHub:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

*Built with ❤️ using SiteScope · Preview powered by [Microlink](https://microlink.io) · Threat data by [URLhaus](https://urlhaus.abuse.ch)*
