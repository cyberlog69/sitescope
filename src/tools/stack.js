// stack.js — Web Technology Fingerprinting Module

import { escapeHtml } from '../utils/helpers.js';

export function detectTechnologies(html, headers) {
  const detected = [];
  const htmlLower = (html || '').toLowerCase();
  
  // Normalize headers to lowercase keys
  const normHeaders = {};
  Object.entries(headers || {}).forEach(([k, v]) => {
    normHeaders[k.toLowerCase()] = String(v).toLowerCase();
  });

  // 1. CDNs & Cloud Providers
  if (normHeaders['cf-ray'] || normHeaders['cf-cache-status'] || normHeaders['server'] === 'cloudflare') {
    detected.push({ name: 'Cloudflare', category: 'CDN/Security', icon: '☁️' });
  }
  if (normHeaders['server'] === 'vercel' || normHeaders['x-vercel-id']) {
    detected.push({ name: 'Vercel', category: 'Hosting/Cloud', icon: '▲' });
  }
  if (normHeaders['server'] === 'netlify' || normHeaders['x-nf-request-id']) {
    detected.push({ name: 'Netlify', category: 'Hosting/Cloud', icon: '◈' });
  }
  if (normHeaders['x-amz-cf-id'] || (normHeaders['via'] && normHeaders['via'].includes('cloudfront'))) {
    detected.push({ name: 'Amazon CloudFront', category: 'CDN', icon: '📦' });
  }
  if (normHeaders['fastly-restarts'] || normHeaders['x-fastly-request-id']) {
    detected.push({ name: 'Fastly', category: 'CDN', icon: '⚡' });
  }

  // 2. Web Servers
  const serverHeader = normHeaders['server'] || '';
  if (serverHeader.includes('nginx')) {
    detected.push({ name: 'Nginx', category: 'Web Server', icon: '⚙️' });
  } else if (serverHeader.includes('apache')) {
    detected.push({ name: 'Apache', category: 'Web Server', icon: '🏹' });
  } else if (serverHeader.includes('litespeed')) {
    detected.push({ name: 'LiteSpeed', category: 'Web Server', icon: '⚡' });
  } else if (serverHeader.includes('caddy')) {
    detected.push({ name: 'Caddy', category: 'Web Server', icon: '🔒' });
  } else if (serverHeader.includes('microsoft-iis')) {
    detected.push({ name: 'IIS', category: 'Web Server', icon: '🖥️' });
  }

  // 3. CMS Platforms
  if (htmlLower.includes('wp-content') || htmlLower.includes('wp-includes') || htmlLower.includes('generator" content="wordpress')) {
    detected.push({ name: 'WordPress', category: 'CMS', icon: '📝' });
  }
  if (htmlLower.includes('shopify.theme') || htmlLower.includes('cdn.shopify.com')) {
    detected.push({ name: 'Shopify', category: 'CMS / E-Commerce', icon: '🛍️' });
  }
  if (htmlLower.includes('static1.squarespace.com') || htmlLower.includes('squarespace.com')) {
    detected.push({ name: 'Squarespace', category: 'CMS', icon: '📐' });
  }
  if (htmlLower.includes('wix.com') || htmlLower.includes('wix-code')) {
    detected.push({ name: 'Wix', category: 'CMS', icon: '✨' });
  }
  if (htmlLower.includes('ghost-sdk') || htmlLower.includes('generator" content="ghost')) {
    detected.push({ name: 'Ghost', category: 'CMS / Blog', icon: '👻' });
  }
  if (htmlLower.includes('drupal.js') || htmlLower.includes('generator" content="drupal')) {
    detected.push({ name: 'Drupal', category: 'CMS', icon: '💧' });
  }

  // 4. Frontend Frameworks
  if (htmlLower.includes('_next/static') || normHeaders['x-powered-by'] === 'next.js') {
    detected.push({ name: 'Next.js', category: 'UI Framework', icon: '▲' });
  }
  if (htmlLower.includes('__nuxt__') || htmlLower.includes('nuxt-link')) {
    detected.push({ name: 'Nuxt.js', category: 'UI Framework', icon: '💚' });
  }
  if (htmlLower.includes('react-root') || htmlLower.includes('data-reactroot') || htmlLower.includes('_react')) {
    detected.push({ name: 'React', category: 'JS Library', icon: '⚛️' });
  }
  if (htmlLower.includes('v-cloak') || htmlLower.includes('data-v-') || htmlLower.includes('__vue__')) {
    detected.push({ name: 'Vue.js', category: 'JS Library', icon: '🖖' });
  }
  if (htmlLower.includes('ng-version') || htmlLower.includes('ng-app') || htmlLower.includes('_ngcontent')) {
    detected.push({ name: 'Angular', category: 'UI Framework', icon: '🅰️' });
  }
  if (htmlLower.includes('svelte-')) {
    detected.push({ name: 'Svelte', category: 'UI Framework', icon: '🔥' });
  }
  if (htmlLower.includes('jquery.js') || htmlLower.includes('jquery.min.js')) {
    detected.push({ name: 'jQuery', category: 'JS Library', icon: '🔌' });
  }
  if (htmlLower.includes('gatsby-') || htmlLower.includes('___gatsby')) {
    detected.push({ name: 'Gatsby', category: 'UI Framework', icon: '💜' });
  }

  // 5. Analytics & Tag Managers
  if (htmlLower.includes('google-analytics.com') || htmlLower.includes('googletagmanager.com/gtag') || htmlLower.includes('_ga')) {
    detected.push({ name: 'Google Analytics', category: 'Analytics', icon: '📊' });
  }
  if (htmlLower.includes('googletagmanager.com/gtm.js')) {
    detected.push({ name: 'Google Tag Manager', category: 'Analytics', icon: '🏷️' });
  }
  if (htmlLower.includes('connect.facebook.net') || htmlLower.includes('fbq(')) {
    detected.push({ name: 'Facebook Pixel', category: 'Marketing', icon: '👥' });
  }
  if (htmlLower.includes('static.hotjar.com') || htmlLower.includes('hj(')) {
    detected.push({ name: 'Hotjar', category: 'UX Analytics', icon: '🔥' });
  }

  return detected;
}

export function renderStackPanel(techList, containerEl) {
  if (!containerEl) return;

  if (!techList || !techList.length) {
    containerEl.innerHTML = `
      <div class="info-value" style="padding:14px;text-align:center;">
        No specific technology signatures detected on the site.
      </div>
    `;
    return;
  }

  const itemsHtml = techList.map(t => {
    return `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.3rem;">${t.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:0.8rem;color:var(--text);">${escapeHtml(t.name)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">${escapeHtml(t.category)}</div>
        </div>
      </div>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div style="padding:14px;">
      <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">Detected Technologies (${techList.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;">
        ${itemsHtml}
      </div>
    </div>
  `;
}


