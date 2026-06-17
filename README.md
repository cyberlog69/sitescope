# SiteScope — Instant Website Checker

A beautiful, dark-mode website intelligence tool that lets you paste any URL and instantly get:

- 🖼️ **Live Screenshot** — rendered via [Microlink API](https://microlink.io)
- 🔴 **Live Frame** — embed the actual site in an iframe
- 📝 **Site Description** — pulled from the page's meta tags
- 🏷️ **Site Category** — intelligent classification into 16+ categories
- 🌐 **Metadata** — favicon, author, language, protocol, Open Graph image, keywords

## Categories Detected

| | Category |
|---|---|
| 🏛️ | Government |
| 🎖️ | Military / Defense |
| 🎓 | Education |
| 🏥 | Healthcare & Medical |
| 🏢 | Business / Enterprise Portal |
| 💰 | Finance & Banking |
| 🛒 | E-Commerce / Shopping |
| 📱 | Social Media |
| 💻 | Technology & Software |
| 📰 | News & Media |
| 🎮 | Gaming |
| 🎬 | Entertainment & Streaming |
| 📚 | Reference & Encyclopedia |
| 🎨 | Design & Creative |
| ✈️ | Travel & Tourism |
| 🍕 | Food & Lifestyle |

## How the Classifier Works

The classification engine uses a **7-layer scoring system**:

1. **TLD match** — `.gov`, `.edu`, `.mil` → instant strong signal (+80 pts)
2. **Known domain match** — 200+ curated domains per category (+60 pts)
3. **Subdomain/path token analysis** — e.g. `proview.nonprod.caqh.org` → extracts `proview`, `caqh` as healthcare signals (+25 pts each)
4. **Keyword scoring** — variable-weight keywords on title + description + URL
5. **Negative keywords** — penalise false positives (–12 pts each)
6. **`requireDomain` gate** — Social Media can *only* win with a known domain match
7. **Confidence threshold** — shows `✓ High`, `~ Medium`, or `? Low` confidence

## Tech Stack

- Pure **HTML + CSS + JavaScript** (no frameworks, no build step)
- [Microlink API](https://microlink.io) for screenshots and metadata (free tier)
- [Google Favicon Service](https://www.google.com/s2/favicons) for site icons
- Google Fonts (Inter + Space Grotesk)

## Usage

Just open `index.html` in any modern browser — no server needed.

```
Website Checker/
├── index.html   # App structure
├── style.css    # Dark glassmorphism design
├── app.js       # Logic + classification engine
└── README.md
```

## Live Preview

Paste any URL → click **Check Site** → get instant results.

> Some sites block iframe embedding via `X-Frame-Options`. Use the **Screenshot** tab if the Live Frame is blank.

---

Built with ❤️ using SiteScope
