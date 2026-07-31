import { describe, it, expect } from 'vitest';
import { parseCrtShResponse } from './subdomains.js';

describe('subdomains module', () => {
  describe('parseCrtShResponse', () => {
    it('handles null or non-array records gracefully', () => {
      const result = parseCrtShResponse(null, 'example.com');
      expect(result.subdomains).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('extracts, cleans, deduplicates and sorts subdomains from crt.sh records', () => {
      const records = [
        { name_value: 'api.example.com\n*.dev.example.com' },
        { name_value: 'admin.example.com\napi.example.com' },
        { name_value: 'example.com' }, // Base domain itself should be filtered out
        { name_value: 'otherdomain.com' } // Non-matching domain should be filtered out
      ];

      const result = parseCrtShResponse(records, 'example.com');
      expect(result.subdomains).toEqual(['admin.example.com', 'api.example.com', 'dev.example.com']);
      expect(result.totalCount).toBe(3);
    });

    it('categorizes subdomains correctly into functional tags', () => {
      const records = [
        { name_value: 'api.example.com' },
        { name_value: 'dev.example.com' },
        { name_value: 'admin.example.com' },
        { name_value: 'mail.example.com' },
        { name_value: 'app.example.com' },
        { name_value: 'custom-foo.example.com' }
      ];

      const result = parseCrtShResponse(records, 'example.com');
      expect(result.categories['API/Services']).toContain('api.example.com');
      expect(result.categories['Dev/Staging']).toContain('dev.example.com');
      expect(result.categories['Admin/Auth']).toContain('admin.example.com');
      expect(result.categories['Mail/DNS']).toContain('mail.example.com');
      expect(result.categories['Web App']).toContain('app.example.com');
      expect(result.categories['Other']).toContain('custom-foo.example.com');
    });
  });
});
