// @ts-check
// seo.js — Visual SEO & Social Card Simulator (OG, Twitter & Search Preview)

/**
 * @typedef {{
 *   title: string | null,
 *   description: string | null,
 *   canonical: string | null,
 *   robots: string | null,
 *   keywords: string[],
 *   author: string | null,
 *   og: {
 *     title: string | null,
 *     description: string | null,
 *     image: string | null,
 *     url: string | null,
 *     siteName: string | null,
 *     type: string | null
 *   },
 *   twitter: {
 *     card: string | null,
 *     title: string | null,
 *     description: string | null,
 *     image: string | null,
 *     site: string | null,
 *     creator: string | null
 *   },
 *   jsonLdSchemas: string[],
 *   seoScore: number,
 *   seoGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
 *   checklist: Array<{ pass: boolean, label: string, hint: string }>,
 *   recommendedMetaTagsSnippet: string
 * }} SeoMetadataResult
 */

/**
 * Extract attribute value from a meta tag regex match.
 * @param {string} html
 * @param {string} nameOrProp
 * @returns {string | null}
 */
function getMetaContent(html, nameOrProp) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["']|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
    'i'
  );
  const match = html.match(pattern);
  return match ? (match[1] || match[2] || '').trim() : null;
}

/**
 * Extract tag inner text or href.
 * @param {string} html
 * @returns {{ title: string | null, canonical: string | null, jsonLd: string[] }}
 */
function extractDocHeadTags(html) {
  // Title tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

  // Canonical tag
  const canonMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonical = canonMatch ? canonMatch[1].trim() : null;

  // JSON-LD scripts
  const jsonLd = [];
  const ldRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed['@type']) {
        const types = Array.isArray(parsed['@type']) ? parsed['@type'] : [parsed['@type']];
        types.forEach((t) => jsonLd.push(String(t)));
      } else if (Array.isArray(parsed['@graph'])) {
        parsed['@graph'].forEach((item) => {
          if (item['@type']) jsonLd.push(String(item['@type']));
        });
      }
    } catch {
      // Ignore invalid JSON-LD strings
    }
  }

  return { title, canonical, jsonLd };
}

/**
 * Extract comprehensive SEO and Social Media metadata from page HTML.
 * @param {string} html
 * @param {string} url
 * @param {string} domain
 * @returns {SeoMetadataResult}
 */
export function extractSeoMetadata(html = '', url = '', domain = '') {
  const content = html || '';
  const headData = extractDocHeadTags(content);

  const title = headData.title || getMetaContent(content, 'og:title') || domain || 'Website Preview';
  const description = getMetaContent(content, 'description') || getMetaContent(content, 'og:description') || null;
  const canonical = headData.canonical || getMetaContent(content, 'og:url') || url;
  const robots = getMetaContent(content, 'robots') || getMetaContent(content, 'googlebot') || 'index, follow';
  const keywordsRaw = getMetaContent(content, 'keywords');
  const keywords = keywordsRaw ? keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean) : [];
  const author = getMetaContent(content, 'author');

  const og = {
    title: getMetaContent(content, 'og:title') || title,
    description: getMetaContent(content, 'og:description') || description,
    image: getMetaContent(content, 'og:image'),
    url: getMetaContent(content, 'og:url') || canonical,
    siteName: getMetaContent(content, 'og:site_name') || domain,
    type: getMetaContent(content, 'og:type') || 'website'
  };

  const twitter = {
    card: getMetaContent(content, 'twitter:card') || (og.image ? 'summary_large_image' : 'summary'),
    title: getMetaContent(content, 'twitter:title') || og.title,
    description: getMetaContent(content, 'twitter:description') || og.description,
    image: getMetaContent(content, 'twitter:image') || og.image,
    site: getMetaContent(content, 'twitter:site'),
    creator: getMetaContent(content, 'twitter:creator')
  };

  // Checklist Evaluation
  /** @type {Array<{ pass: boolean, label: string, hint: string }>} */
  const checklist = [];

  // Title tag length
  const titleLen = title.length;
  const titlePass = titleLen >= 30 && titleLen <= 65;
  checklist.push({
    pass: titlePass,
    label: `Page Title Length (${titleLen} chars)`,
    hint: titlePass ? 'Optimal length for Google search results (30-65 chars).' : 'Recommended length is 30 to 65 characters to prevent truncation.'
  });

  // Meta description length
  const descLen = description ? description.length : 0;
  const descPass = descLen >= 110 && descLen <= 165;
  checklist.push({
    pass: descPass,
    label: `Meta Description (${descLen} chars)`,
    hint: descPass ? 'Optimal length for search snippets (110-165 chars).' : 'Optimal snippet length is 110 to 165 characters.'
  });

  // Open Graph Image
  const hasOgImage = Boolean(og.image);
  checklist.push({
    pass: hasOgImage,
    label: 'Open Graph Social Image (og:image)',
    hint: hasOgImage ? 'High-impact social thumbnail present.' : 'Add an og:image (1200x630px recommended) for rich social cards.'
  });

  // Twitter Card
  const hasTwitterCard = Boolean(getMetaContent(content, 'twitter:card') || getMetaContent(content, 'twitter:title'));
  checklist.push({
    pass: hasTwitterCard,
    label: 'Twitter / X Card Metadata',
    hint: hasTwitterCard ? 'Twitter cards configured.' : 'Add twitter:card, twitter:title, and twitter:image.'
  });

  // Canonical Link
  const hasCanonical = Boolean(headData.canonical);
  checklist.push({
    pass: hasCanonical,
    label: 'Canonical Tag (<link rel="canonical">)',
    hint: hasCanonical ? 'Prevents duplicate content indexation.' : 'Add a canonical URL tag pointing to preferred domain version.'
  });

  // JSON-LD Structured Data
  const hasJsonLd = headData.jsonLd.length > 0;
  checklist.push({
    pass: hasJsonLd,
    label: `Structured Data (${headData.jsonLd.length} Schema types)`,
    hint: hasJsonLd ? `Schemas found: ${headData.jsonLd.join(', ')}` : 'Add JSON-LD schema (e.g. WebSite, Organization) for Google rich results.'
  });

  // Calculate SEO Health Score (0–100)
  let score = 20; // baseline
  if (titlePass) score += 20;
  else if (titleLen > 0) score += 10;

  if (descPass) score += 20;
  else if (descLen > 0) score += 10;

  if (hasOgImage) score += 15;
  if (hasTwitterCard) score += 10;
  if (hasCanonical) score += 10;
  if (hasJsonLd) score += 5;

  const seoScore = Math.min(100, Math.max(0, score));

  /** @type {'A+' | 'A' | 'B' | 'C' | 'D' | 'F'} */
  let seoGrade = 'F';
  if (seoScore >= 90) seoGrade = 'A+';
  else if (seoScore >= 80) seoGrade = 'A';
  else if (seoScore >= 70) seoGrade = 'B';
  else if (seoScore >= 60) seoGrade = 'C';
  else if (seoScore >= 50) seoGrade = 'D';

  // Recommended Meta Tags Fix Code Generator
  const recommendedMetaTagsSnippet = `<!-- Recommended Essential SEO & Social Meta Tags -->
<title>${escapeXml(title)}</title>
<meta name="description" content="${escapeXml(description || 'Website description here')}">
<link rel="canonical" href="${escapeXml(canonical || url)}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeXml(canonical || url)}">
<meta property="og:title" content="${escapeXml(og.title || title)}">
<meta property="og:description" content="${escapeXml(og.description || description || '')}">
<meta property="og:image" content="${escapeXml(og.image || 'https://example.com/og-image.jpg')}">

<!-- Twitter / X -->
<meta name="twitter:card" content="${escapeXml(twitter.card || 'summary_large_image')}">
<meta name="twitter:title" content="${escapeXml(twitter.title || title)}">
<meta name="twitter:description" content="${escapeXml(twitter.description || description || '')}">
<meta name="twitter:image" content="${escapeXml(twitter.image || og.image || 'https://example.com/og-image.jpg')}">`;

  return {
    title,
    description,
    canonical,
    robots,
    keywords,
    author,
    og,
    twitter,
    jsonLdSchemas: headData.jsonLd,
    seoScore,
    seoGrade,
    checklist,
    recommendedMetaTagsSnippet
  };
}

/**
 * Escape XML/HTML special characters in code generator.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
