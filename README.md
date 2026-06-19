# 🔍 SiteScope — Instant Website Checker

> Paste any URL and get a live preview, metadata, category classification, and full site analysis in seconds.

![SiteScope](https://img.shields.io/badge/SiteScope-v2.0-6c63ff?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![No Build](https://img.shields.io/badge/No%20Build%20Required-✓-38bdf8?style=for-the-badge)

---

## ✨ Features

### 🔎 Single Check Mode
- **Live Screenshot** — rendered via the [Microlink API](https://microlink.io)
- **Live Frame** — embed the actual site in a sandboxed iframe
- **Site Description** — pulled from the page's `<meta>` tags
- **Site Category** — AI-style classification into 16+ categories with confidence scoring
- **Metadata Panel** — favicon, author, language, protocol, Open Graph image, keywords/tags

### 📋 Bulk Check Mode *(New!)*
- Paste up to **25 URLs** at once (one per line or comma-separated)
- **Live progress bar** showing which site is currently being checked
- **Real-time results table** — rows fill in as each site completes
- **Skeleton loading rows** — placeholders animate while data is fetched
- **Stop button** — cancel a bulk run at any time
- **Summary stats** — Total / Reachable / Failed / Time elapsed
- **Export CSV** — download all results as a `.csv` file
- **Inspect button** — click any row to run a full single-check on that URL

---

## 🏷️ Site Categories

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

---

## 🧠 How the Classifier Works

The classification engine uses a **7-layer scoring system** to accurately identify any website:

| Layer | Signal | Points |
|:---:|---|:---:|
| 1 | **TLD match** — `.gov`, `.edu`, `.mil` | +80 |
| 2 | **Known domain match** — 200+ curated domains | +60 |
| 3 | **Subdomain/path token analysis** — e.g. `proview.nonprod.caqh.org` extracts `proview`, `caqh` as healthcare signals | +25 each |
| 4 | **Keyword scoring** — variable-weight terms on title + description + URL | variable |
| 5 | **Negative keywords** — penalise false positives | −12 each |
| 6 | **`requireDomain` gate** — Social Media can *only* win with a confirmed known domain | gate |
| 7 | **Confidence threshold** — displays `✓ High`, `~ Medium`, or `? Low` confidence | display |

> **Example:** `https://proview-sit2.nonprod.caqh.org/` → correctly classified as **Healthcare & Medical** because the subdomain tokens `proview`, `nonprod`, `caqh` all match healthcare signals, and `caqh.org` is in the known domain list.

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| HTML + CSS + JavaScript | Core app — no framework, no build step |
| [Microlink API](https://microlink.io) | Screenshots & metadata (free tier) |
| [Google Favicon Service](https://www.google.com/s2/favicons) | Site icons |
| Google Fonts (Inter + Space Grotesk) | Typography |

---

## 🚀 Usage

Just open `index.html` in any modern browser — **no server, no install needed**.

```
Website Checker/
├── index.html   # App structure & UI
├── style.css    # Dark glassmorphism design system
├── app.js       # Logic, classification engine & bulk checker
└── README.md    # This file
```

### Single Check
1. Type or paste any URL into the input box
2. Press **Check Site** or hit `Enter`
3. View the screenshot, metadata, category and description

### Bulk Check
1. Click **Bulk Check** in the mode toggle
2. Paste up to 25 URLs (one per line)
3. Click **Run Bulk Check**
4. Watch results populate live in the table
5. Click **Export CSV** to download the results

---

## ⚠️ Notes

- Some sites block iframe embedding via `X-Frame-Options` — use the **Screenshot** tab if the Live Frame is blank.
- The Microlink free tier has rate limits. The bulk checker adds a ~600ms delay between requests to be respectful.
- Screenshots are only fetched in **Single** mode. Bulk mode uses metadata-only requests for speed.

---

## 📊 CSV Export Columns

| Column | Description |
|---|---|
| # | Row number |
| URL | Full URL that was checked |
| Title | Page `<title>` from metadata |
| Category | Classified category label |
| Status | `Reachable` or `Failed` |
| Language | Page language code (e.g. `EN`) |
| Description | Meta description text |

---

## 🔗 Repository

**GitHub:** [github.com/cyberlog69/sitescope](https://github.com/cyberlog69/sitescope)

---

*Built with ❤️ using SiteScope · Preview powered by [Microlink](https://microlink.io)*
