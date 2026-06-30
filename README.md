# 🔍 SiteScope v4 — Instant Website Intelligence & Security Sandbox

> A blazing-fast, installable Progressive Web App (PWA) that provides live website previews, metadata extraction, category classification, deep security threat analysis, and a fully isolated sandbox. Now powered by a modern Vite build system with cloud history and advanced network intelligence. No signup required.

![SiteScope](https://img.shields.io/badge/SiteScope-v4.0-7c3aed?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-06b6d4?style=for-the-badge)
![No Signup](https://img.shields.io/badge/No%20Signup-✓-ec4899?style=for-the-badge)

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🎨 **Cosmic UI** | Dark cosmic theme, glassmorphic panels, animated gradient mesh, and neon accents with GPU-accelerated rendering. |
| 📱 **PWA Ready** | Installable as a standalone app on desktop and mobile. Uses a Service Worker for offline UI caching and instantaneous load times. |
| ☁️ **Cloud History** | Recent scans are pushed to a lightweight cloud endpoint (kvdb.io) and synchronized across your session. |
| 🛡️ **Isolated Sandbox** | Sanitized HTML rendered safely — scripts, trackers, and malicious embedded elements stripped natively. |
| 🔗 **Link Extractor** | Automatically plucks and lists all hyperlinks found on the target page during the sandbox phase. |
| 🌐 **Advanced Intel** | Real-time WHOIS domain lookups, IP & Location mapping (via Google DNS), and HTTP Security Header analysis. |
| 📧 **Email Validator** | Complete RFC 5322 validation, MX lookup, 400+ disposable domain checks, and heuristic scam scoring. |
| 🔐 **Security Scanner** | 2-stage threat detection: blazing-fast local heuristics + URLhaus malware DB integration. |
| 📋 **Bulk Check** | Check up to 25 URLs at once with live progress. Filter by threat level, sort columns, and export to CSV. |
| 📱 **QR Generator** | One-click dynamic QR code generation for the scanned target URL. |
| ⚡ **Zero-CPU Rendering** | CSS glassmorphism and background meshes have been heavily optimized (using native radial gradients instead of expensive CSS blur filters) to prevent composite explosion and CPU lockup. |

---

## 🛡️ Isolated Sandbox Container

The Sandbox tab is the safest way to visually inspect any website without running its JavaScript or allowing trackers. SiteScope:

1. **Fetches** the page HTML through a CORS proxy (`allorigins.win`).
2. **Sanitizes** the HTML through a highly-optimized 10-layer DOM protection pipeline.
3. **Renders** only the cleaned HTML in a maximally-restricted `<iframe>`.

---

## 🧠 Advanced Network Intelligence

Every site check automatically pulls multi-layered intelligence directly from the source:
- **IP & DNS Resolution:** Natively resolves the site's A-records using Google DoH.
- **WHOIS Lookups:** Pulls domain registration details (Registrar, Creation Date) via the NetworkCalc API.
- **HTTP Headers:** Analyzes and highlights critical security headers (e.g., `Strict-Transport-Security`, `Content-Security-Policy`) using the HackerTarget API.

---

## 📧 Email Validator & Scam Checker

Verify email addresses instantly without sending a message:
1. **Syntax Check**: Strict regex validation for correct formatting.
2. **Disposable Check**: Flags over 400 known disposable email providers (Mailinator, 10minutemail, etc.).
3. **MX Lookup**: Verifies that the domain has valid mail servers configured.
4. **Heuristic Scam Scoring**: Flags suspicious usernames (`admin`, `support`), high-entropy strings, and outputs a Risk Score.

---

## 🛠️ Architecture & Tech Stack

SiteScope has evolved into a fully modular application powered by **Vite**.

| Tool | Purpose |
|---|---|
| **Vite** | Lightning-fast build system, module bundler, and HMR engine (Audited: 0 vulnerabilities) |
| **ES Modules** | Clean, split architecture (`src/main.js`, `src/intel.js`, etc.) |
| **Service Worker** | Caches UI shell assets for immediate offline loading (`public/sw.js`) |
| **kvdb.io** | Cloud endpoint for stateless, cross-session history |
| **Microlink API** | Screenshots & metadata (free tier) |
| **allorigins.win** | CORS proxy for sandbox HTML fetching (free) |
| **URLhaus API** | Malware / phishing URL database (free) |

---

## 🚀 Getting Started (Development)

SiteScope now uses a modern build process. To run the app locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/cyberlog69/sitescope.git
   cd sitescope
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server (with Hot Module Replacement):
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
   *(This will create a highly optimized, minified bundle in the `dist/` directory).*

---

## 🌍 Internet Hosting & Deployment

Because SiteScope is completely decoupled from any proprietary backend, it is incredibly simple to deploy globally for free.

### Vercel or Netlify (Recommended)
This is the easiest way to deploy a Vite app:
1. Sign up to [Vercel](https://vercel.com/) or [Netlify](https://netlify.com/) with your GitHub account.
2. Import the `cyberlog69/sitescope` repository.
3. The platform will automatically detect Vite and run `npm run build`.
4. Click **Deploy**. Your PWA is now live globally!

### GitHub Pages
1. Go to your repository settings on GitHub.
2. Under "Pages", set the source to GitHub Actions.
3. Use a basic Vite/Node.js workflow to build and deploy your `dist/` folder.

---

## ⚠️ Notes & Limitations

| Limitation | Details |
|---|---|
| Sandbox Proxy | `allorigins.win` is a free service — may be slow or rate-limited for some sites. |
| Screenshot Availability | Microlink free tier may not capture all sites perfectly. |
| URLhaus DB | Checks active/recent threats; historical or brand-new zero-day threats may not appear. |
| Bulk Rate Limit | 600ms delay between requests to respect free-tier API limits. |
| Cloud History | History is stored in a public KV bucket; do not enter sensitive private URLs. |

---

## 🔗 Repository

**GitHub:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

*Built with ❤️ using SiteScope v4 · Preview powered by [Microlink](https://microlink.io) · Threat data by [URLhaus](https://urlhaus.abuse.ch)*
