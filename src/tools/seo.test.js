import { describe, it, expect } from 'vitest';
import { extractSeoMetadata } from './seo.js';

describe('seo module', () => {
  it('extracts complete SEO, Open Graph, Twitter, and JSON-LD metadata', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SiteScope — Instant Website Intelligence & Security Sandbox</title>
          <meta name="description" content="A blazing-fast, installable Progressive Web App that delivers instant website previews, deep metadata extraction, and security audits." />
          <link rel="canonical" href="https://sitescope.dev" />
          <meta property="og:title" content="SiteScope Pro" />
          <meta property="og:description" content="Deep metadata & security sandbox." />
          <meta property="og:image" content="https://sitescope.dev/og.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="SiteScope on X" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "SiteScope"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const res = extractSeoMetadata(html, 'https://sitescope.dev', 'sitescope.dev');
    expect(res.title).toContain('SiteScope');
    expect(res.canonical).toBe('https://sitescope.dev');
    expect(res.og.image).toBe('https://sitescope.dev/og.png');
    expect(res.twitter.card).toBe('summary_large_image');
    expect(res.jsonLdSchemas).toContain('WebApplication');
    expect(res.seoScore).toBeGreaterThanOrEqual(80);
    expect(res.recommendedMetaTagsSnippet).toContain('<meta property="og:image"');
  });

  it('handles missing metadata gracefully with defaults and calculates appropriate score', () => {
    const html = '<html><head><title>Hi</title></head><body>No meta tags</body></html>';
    const res = extractSeoMetadata(html, 'https://example.com', 'example.com');
    expect(res.title).toBe('Hi');
    expect(res.description).toBeNull();
    expect(res.og.image).toBeNull();
    expect(res.seoScore).toBeLessThan(70);
    expect(res.checklist.length).toBeGreaterThan(0);
  });
});
