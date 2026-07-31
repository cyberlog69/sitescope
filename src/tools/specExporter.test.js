import { describe, it, expect } from 'vitest';
import { generatePostmanCollection, generateOpenApiSpec } from './specExporter.js';

describe('specExporter module', () => {
  const sampleLinks = [
    { url: 'https://example.com/api/users', text: 'Users API' },
    { url: 'https://example.com/api/products', text: 'Products API' }
  ];

  it('generates valid Postman Collection v2.1 schema', () => {
    const postman = generatePostmanCollection('example.com', sampleLinks, 'https://example.com');
    expect(postman.info.schema).toContain('v2.1.0');
    expect(postman.info.name).toContain('example.com');
    expect(postman.item.length).toBe(2);
    expect(postman.item[0].request.method).toBe('GET');
    expect(postman.item[0].request.url.raw).toBe('https://example.com/api/users');
  });

  it('generates valid OpenAPI 3.0.3 specification', () => {
    const openapi = generateOpenApiSpec('example.com', sampleLinks, 'https://example.com');
    expect(openapi.openapi).toBe('3.0.3');
    expect(openapi.info.title).toContain('example.com');
    expect(openapi.servers[0].url).toBe('https://example.com');
    expect(openapi.paths['/api/users']).toBeDefined();
    expect(openapi.paths['/api/users'].get.summary).toBe('Users API');
  });
});
