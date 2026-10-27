import { describe, it, expect, vi } from 'vitest';
import { exportAsJson, exportAsMarkdown } from './exporter.js';

describe('exporter', () => {
  it('generates markdown report content correctly', () => {
    // Mock URL.createObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock anchor click
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn()
    };
    vi.spyOn(document, 'createElement').mockReturnValue(/** @type {any} */ (mockAnchor));

    const sampleData = {
      domain: 'example.com',
      url: 'https://example.com',
      timestamp: '2026-07-24T18:00:00.000Z',
      scorecard: {
        grade: 'A',
        score: 90,
        strengths: ['Enforces HTTPS'],
        remediations: [{ severity: 'low', title: 'HSTS', description: 'Enable HSTS' }]
      },
      security: { level: 'safe', dbStatus: 'clean', findings: [] }
    };

    exportAsMarkdown(sampleData);
    expect(mockAnchor.download).toContain('sitescope-report-example.com.md');
    expect(mockAnchor.click).toHaveBeenCalled();

    exportAsJson(sampleData);
    expect(mockAnchor.download).toContain('sitescope-report-example.com.json');
  });
});
