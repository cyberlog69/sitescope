// @ts-check
// aiPolicy.js — AI Scraper & LLM Crawler Policy Inspector (ai.txt / AI Bot Control)

import { logWarn } from '../utils/logger.js';
import { fetchViaCorsProxy } from '../utils/proxy.js';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   operator: string,
 *   purpose: string,
 *   status: 'BLOCKED' | 'ALLOWED' | 'PARTIALLY_RESTRICTED' | 'UNSPECIFIED',
 *   ruleText: string
 * }} AiBotInspection
 */

/**
 * @typedef {{
 *   domain: string,
 *   posture: 'FULLY_BLOCKED' | 'PARTIALLY_RESTRICTED' | 'OPEN_ACCESS',
 *   blockedCount: number,
 *   allowedCount: number,
 *   totalAiBots: number,
 *   hasNoAiMeta: boolean,
 *   hasAiTxt: boolean,
 *   aiTxtContent: string | null,
 *   bots: AiBotInspection[],
 *   recommendedRobotsSnippet: string
 * }} AiPolicyResult
 */

/**
 * List of recognized AI scrapers, LLM training crawlers, and AI search agents.
 */
export const KNOWN_AI_BOTS = [
  { id: 'gptbot', userAgent: 'GPTBot', name: 'GPTBot', operator: 'OpenAI', purpose: 'LLM Model Training (GPT-4 / GPT-5)' },
  { id: 'chatgpt-user', userAgent: 'ChatGPT-User', name: 'ChatGPT User', operator: 'OpenAI', purpose: 'Real-time ChatGPT Web Browsing' },
  { id: 'claudebot', userAgent: 'ClaudeBot', name: 'ClaudeBot', operator: 'Anthropic', purpose: 'Claude AI Training & Web Retrieval' },
  { id: 'claude-web', userAgent: 'Claude-Web', name: 'Claude-Web', operator: 'Anthropic', purpose: 'Claude Real-time Search' },
  { id: 'google-extended', userAgent: 'Google-Extended', name: 'Google-Extended', operator: 'Google', purpose: 'Gemini / Vertex AI Model Training' },
  { id: 'perplexitybot', userAgent: 'PerplexityBot', name: 'PerplexityBot', operator: 'Perplexity AI', purpose: 'AI Search Indexing & Answer Generation' },
  { id: 'ccbot', userAgent: 'CCBot', name: 'CCBot (Common Crawl)', operator: 'Common Crawl', purpose: 'Open Web Dataset for LLM Training' },
  { id: 'bytespider', userAgent: 'ByteSpider', name: 'ByteSpider', operator: 'ByteDance', purpose: 'TikTok & Doubao LLM Training' },
  { id: 'applebot-extended', userAgent: 'Applebot-Extended', name: 'Applebot-Extended', operator: 'Apple', purpose: 'Apple Intelligence Training' },
  { id: 'meta-externalagent', userAgent: 'Meta-ExternalAgent', name: 'Meta-ExternalAgent', operator: 'Meta', purpose: 'Llama AI Training & Retrieval' },
  { id: 'diffbot', userAgent: 'Diffbot', name: 'Diffbot', operator: 'Diffbot', purpose: 'AI Knowledge Graph Extraction' },
  { id: 'cohere-ai', userAgent: 'cohere-ai', name: 'cohere-ai', operator: 'Cohere', purpose: 'Enterprise LLM Training' },
  { id: 'amazonbot', userAgent: 'Amazonbot', name: 'Amazonbot', operator: 'Amazon', purpose: 'Amazon Nova / Alexa AI Training' }
];

/**
 * Parse robots.txt lines into user-agent directive blocks.
 * @param {string} robotsContent
 * @returns {Record<string, { allow: string[], disallow: string[] }>}
 */
function parseRobotsDirectives(robotsContent = '') {
  /** @type {Record<string, { allow: string[], disallow: string[] }>} */
  const agents = {};
  if (!robotsContent) return agents;

  const lines = robotsContent.split('\n');
  /** @type {string[]} */
  const currentAgents = [];

  lines.forEach((line) => {
    const cleaned = line.replace(/#.*$/, '').trim();
    if (!cleaned) return;

    const [key, ...rest] = cleaned.split(':');
    if (!key || !rest.length) return;

    const directive = key.trim().toLowerCase();
    const val = rest.join(':').trim();

    if (directive === 'user-agent') {
      const ua = val.toLowerCase();
      if (!agents[ua]) {
        agents[ua] = { allow: [], disallow: [] };
      }
      currentAgents.push(ua);
    } else if (directive === 'disallow') {
      currentAgents.forEach((ua) => {
        if (agents[ua]) agents[ua].disallow.push(val);
      });
    } else if (directive === 'allow') {
      currentAgents.forEach((ua) => {
        if (agents[ua]) agents[ua].allow.push(val);
      });
    }
  });

  return agents;
}

/**
 * Inspect robots.txt rules for a specific AI bot.
 * @param {Record<string, { allow: string[], disallow: string[] }>} parsed
 * @param {string} userAgent
 * @param {boolean} hasNoAiMeta
 * @returns {{ status: 'BLOCKED' | 'ALLOWED' | 'PARTIALLY_RESTRICTED' | 'UNSPECIFIED', ruleText: string }}
 */
function evaluateBotStatus(parsed, userAgent, hasNoAiMeta) {
  if (hasNoAiMeta) {
    return { status: 'BLOCKED', ruleText: 'Blocked via HTML <meta name="robots" content="noai">' };
  }

  const ua = userAgent.toLowerCase();
  const botRules = parsed[ua];
  const wildcardRules = parsed['*'];

  // Check specific bot directives first
  if (botRules) {
    const isRootDisallowed = botRules.disallow.some((p) => p === '/' || p === '/*');
    if (isRootDisallowed) {
      return { status: 'BLOCKED', ruleText: `Disallow: ${botRules.disallow.join(', ')}` };
    }
    if (botRules.disallow.length > 0) {
      return { status: 'PARTIALLY_RESTRICTED', ruleText: `Restricted paths: ${botRules.disallow.slice(0, 3).join(', ')}` };
    }
    if (botRules.allow.length > 0) {
      return { status: 'ALLOWED', ruleText: `Allow: ${botRules.allow.join(', ')}` };
    }
  }

  // Fallback to wildcard rules (*)
  if (wildcardRules) {
    const isRootDisallowed = wildcardRules.disallow.some((p) => p === '/' || p === '/*');
    if (isRootDisallowed) {
      return { status: 'BLOCKED', ruleText: 'Inherited Disallow: / from wildcard (*)' };
    }
    if (wildcardRules.disallow.length > 0) {
      return { status: 'PARTIALLY_RESTRICTED', ruleText: `Inherited wildcard restrictions: ${wildcardRules.disallow.slice(0, 3).join(', ')}` };
    }
  }

  return { status: 'UNSPECIFIED', ruleText: 'Allowed (No blocking directives found)' };
}

/**
 * Audit AI Scraper & LLM Crawler policy from robots.txt, HTML, and ai.txt.
 * @param {string} robotsTxt
 * @param {string} html
 * @param {string | null} [aiTxt]
 * @param {string} [domain]
 * @returns {AiPolicyResult}
 */
export function auditAiPolicy(robotsTxt = '', html = '', aiTxt = null, domain = '') {
  const hasNoAiMeta = /<meta\s+[^>]*content=["'][^"']*\bnoai\b[^"']*["']/i.test(html);
  const parsedRobots = parseRobotsDirectives(robotsTxt);
  const hasAiTxt = Boolean(aiTxt && aiTxt.trim().length > 0);

  let blockedCount = 0;
  let allowedCount = 0;

  /** @type {AiBotInspection[]} */
  const bots = KNOWN_AI_BOTS.map((bot) => {
    const { status, ruleText } = evaluateBotStatus(parsedRobots, bot.userAgent, hasNoAiMeta);
    if (status === 'BLOCKED') blockedCount++;
    else if (status === 'ALLOWED' || status === 'UNSPECIFIED') allowedCount++;

    return {
      id: bot.id,
      name: bot.name,
      operator: bot.operator,
      purpose: bot.purpose,
      status,
      ruleText
    };
  });

  /** @type {'FULLY_BLOCKED' | 'PARTIALLY_RESTRICTED' | 'OPEN_ACCESS'} */
  let posture = 'OPEN_ACCESS';
  if (hasNoAiMeta || blockedCount >= 8) {
    posture = 'FULLY_BLOCKED';
  } else if (blockedCount > 0 || bots.some((b) => b.status === 'PARTIALLY_RESTRICTED')) {
    posture = 'PARTIALLY_RESTRICTED';
  }

  const recommendedRobotsSnippet = `# Block all AI training crawlers and LLM scrapers
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ByteSpider
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Amazonbot
Disallow: /`;

  return {
    domain,
    posture,
    blockedCount,
    allowedCount,
    totalAiBots: KNOWN_AI_BOTS.length,
    hasNoAiMeta,
    hasAiTxt,
    aiTxtContent: hasAiTxt ? aiTxt : null,
    bots,
    recommendedRobotsSnippet
  };
}

/**
 * Fetch ai.txt and perform AI policy audit.
 * @param {string} domain
 * @param {string} robotsTxt
 * @param {string} html
 * @returns {Promise<AiPolicyResult>}
 */
export async function fetchAiPolicy(domain, robotsTxt = '', html = '') {
  /** @type {string | null} */
  let aiTxt = null;
  if (domain) {
    try {
      const targetUrl = `https://${domain}/.well-known/ai.txt`;
      const res = await fetchViaCorsProxy(targetUrl, { timeout: 5000 });
      if (res && res.contents && res.contents.length > 5 && !res.contents.includes('<!DOCTYPE html')) {
        aiTxt = res.contents;
      }
    } catch (err) {
      logWarn('fetchAiPolicy:aiTxt', err);
    }
  }

  return auditAiPolicy(robotsTxt, html, aiTxt, domain);
}
