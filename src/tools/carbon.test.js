import { describe, it, expect } from 'vitest';
import { calculateCarbonFootprint, isGreenHosting } from './carbon.js';

describe('carbon module', () => {
  describe('isGreenHosting', () => {
    it('detects green hosts from headers correctly', () => {
      expect(isGreenHosting({ server: 'cloudflare' })).toBe(true);
      expect(isGreenHosting({ 'x-vercel-id': 'iad1' })).toBe(true);
      expect(isGreenHosting({ server: 'apache' })).toBe(false);
      expect(isGreenHosting()).toBe(false);
    });
  });

  describe('calculateCarbonFootprint', () => {
    it('calculates carbon emissions and Eco-Grade A+ for lightweight pages', () => {
      const result = calculateCarbonFootprint(150000, true);
      expect(result.ecoGrade).toBe('A+');
      expect(result.co2PerVisitGrams).toBeLessThan(0.18);
      expect(result.cleanerThanPct).toBeGreaterThan(80);
      expect(result.isGreenHost).toBe(true);
    });

    it('assigns Eco-Grade F for heavy pages without green hosting', () => {
      const result = calculateCarbonFootprint(5000000, false);
      expect(result.ecoGrade).toBe('F');
      expect(result.co2PerVisitGrams).toBeGreaterThan(0.85);
      expect(result.annualCo2Kg).toBeGreaterThan(100);
      expect(result.treesNeeded).toBeGreaterThan(1);
    });
  });
});
