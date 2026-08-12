import { describe, it, expect } from 'vitest';
import { auditAiPolicy } from './aiPolicy.js';

describe('aiPolicy module', () => {
  it('detects blocked AI crawlers in robots.txt and classifies as FULLY_BLOCKED', () => {
    const robotsTxt = `
      User-agent: *
      Disallow: /admin

      User-agent: GPTBot
      Disallow: /

      User-agent: ClaudeBot
      Disallow: /

      User-agent: Google-Extended
      Disallow: /

      User-agent: CCBot
      Disallow: /

      User-agent: PerplexityBot
      Disallow: /

      User-agent: ByteSpider
      Disallow: /

      User-agent: Applebot-Extended
      Disallow: /

      User-agent: Meta-ExternalAgent
      Disallow: /
    `;

    const res = auditAiPolicy(robotsTxt, '<html></html>', null, 'example.com');
    expect(res.posture).toBe('FULLY_BLOCKED');
    expect(res.blockedCount).toBeGreaterThanOrEqual(8);
    const gptBot = res.bots.find((b) => b.id === 'gptbot');
    expect(gptBot?.status).toBe('BLOCKED');
  });

  it('detects HTML noai meta tag directive and marks all bots blocked', () => {
    const html = '<!DOCTYPE html><html><head><meta name="robots" content="noindex, noai, noimageai"></head></html>';
    const res = auditAiPolicy('', html, null, 'example.com');
    expect(res.hasNoAiMeta).toBe(true);
    expect(res.posture).toBe('FULLY_BLOCKED');
    expect(res.bots.every((b) => b.status === 'BLOCKED')).toBe(true);
  });

  it('identifies open access websites and generates recommended blocklist snippet', () => {
    const robotsTxt = 'User-agent: *\nAllow: /';
    const res = auditAiPolicy(robotsTxt, '<html></html>', null, 'open-ai-site.org');
    expect(res.posture).toBe('OPEN_ACCESS');
    expect(res.blockedCount).toBe(0);
    expect(res.recommendedRobotsSnippet).toContain('User-agent: GPTBot');
  });
});
