// @ts-check
// specExporter.js — Postman & OpenAPI Spec Exporter

/**
 * @typedef {{ url: string, text?: string }} ExtractedLink
 */

/**
 * Helper to download content as a file.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export discovered links/endpoints as Postman Collection v2.1.
 * @param {string} domain
 * @param {ExtractedLink[]} links
 * @param {string} [baseUrl]
 * @returns {object}
 */
export function generatePostmanCollection(domain, links = [], baseUrl = '') {
  const host = domain || 'example.com';
  const rootUrl = baseUrl || `https://${host}`;

  const items = links.slice(0, 100).map((l, index) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(l.url);
    } catch {
      parsedUrl = new URL(l.url, rootUrl);
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    return {
      name: l.text ? `${l.text} (${parsedUrl.pathname})` : `Endpoint ${index + 1}: ${parsedUrl.pathname}`,
      request: {
        method: 'GET',
        header: [
          { key: 'User-Agent', value: 'SiteScope/4.0' },
          { key: 'Accept', value: 'application/json, text/html, */*' }
        ],
        url: {
          raw: parsedUrl.href,
          protocol: parsedUrl.protocol.replace(':', ''),
          host: parsedUrl.hostname.split('.'),
          path: pathSegments
        }
      }
    };
  });

  return {
    info: {
      name: `SiteScope Export — ${host}`,
      description: `Discovered endpoints and API paths for ${host} exported via SiteScope v4.`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: items.length > 0 ? items : [
      {
        name: `Root Homepage (${host})`,
        request: {
          method: 'GET',
          header: [{ key: 'User-Agent', value: 'SiteScope/4.0' }],
          url: {
            raw: rootUrl,
            protocol: 'https',
            host: host.split('.'),
            path: []
          }
        }
      }
    ]
  };
}

/**
 * Export discovered links/endpoints as OpenAPI 3.0.3 Specification.
 * @param {string} domain
 * @param {ExtractedLink[]} links
 * @param {string} [baseUrl]
 * @returns {object}
 */
export function generateOpenApiSpec(domain, links = [], baseUrl = '') {
  const host = domain || 'example.com';
  const rootUrl = baseUrl || `https://${host}`;

  /** @type {Record<string, object>} */
  const paths = {};

  const cleanLinks = links.length > 0 ? links : [{ url: rootUrl, text: 'Homepage' }];

  cleanLinks.slice(0, 100).forEach((l) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(l.url);
    } catch {
      parsedUrl = new URL(l.url, rootUrl);
    }

    const pathStr = parsedUrl.pathname || '/';

    if (!paths[pathStr]) {
      paths[pathStr] = {
        get: {
          summary: l.text || `GET ${pathStr}`,
          description: `Discovered endpoint ${parsedUrl.href}`,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'text/html': {},
                'application/json': {}
              }
            }
          }
        }
      };
    }
  });

  return {
    openapi: '3.0.3',
    info: {
      title: `SiteScope API Spec — ${host}`,
      description: `Discovered OpenAPI 3.0 specification for ${host}`,
      version: '1.0.0'
    },
    servers: [
      {
        url: rootUrl,
        description: `Primary server for ${host}`
      }
    ],
    paths
  };
}

/**
 * Trigger Postman Collection JSON export and download.
 * @param {string} domain
 * @param {ExtractedLink[]} links
 * @param {string} [baseUrl]
 */
export function exportPostmanCollection(domain, links = [], baseUrl = '') {
  const collection = generatePostmanCollection(domain, links, baseUrl);
  const jsonStr = JSON.stringify(collection, null, 2);
  const filename = `sitescope-postman-${(domain || 'export').replace(/[^a-z0-9.-]/gi, '_')}.json`;
  downloadFile(jsonStr, filename, 'application/json');
}

/**
 * Trigger OpenAPI 3.0 Spec JSON export and download.
 * @param {string} domain
 * @param {ExtractedLink[]} links
 * @param {string} [baseUrl]
 */
export function exportOpenApiSpec(domain, links = [], baseUrl = '') {
  const spec = generateOpenApiSpec(domain, links, baseUrl);
  const jsonStr = JSON.stringify(spec, null, 2);
  const filename = `sitescope-openapi-${(domain || 'export').replace(/[^a-z0-9.-]/gi, '_')}.json`;
  downloadFile(jsonStr, filename, 'application/json');
}
