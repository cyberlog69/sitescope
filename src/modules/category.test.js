import { describe, it, expect } from 'vitest';
import { classifySite, CATEGORIES } from './category.js';

describe('classifySite', () => {
  it('classifies .gov domains as Government', () => {
    const result = classifySite('https://www.irs.gov', 'IRS', 'tax filing');
    expect(result.category.id).toBe('government');
    expect(result.confidence).toBe('high');
  });

  it('classifies .edu domains as Education', () => {
    const result = classifySite('https://mit.edu', 'MIT', 'university education');
    expect(result.category.id).toBe('education');
  });

  it('classifies known social media domains', () => {
    const result = classifySite('https://twitter.com', 'Twitter', 'social network');
    expect(result.category.id).toBe('social');
  });

  it('classifies amazon.com as E-commerce', () => {
    const result = classifySite('https://amazon.com', 'Amazon', 'online shopping');
    expect(result.category.id).toBe('ecommerce');
  });

  it('returns unknown for unrecognized sites', () => {
    const result = classifySite(
      'https://zzzzzzzzzzzzzzzz.com',
      'Nothing Specific',
      'some random content here',
    );
    expect(result.category.id).toBe('unknown');
  });

  it('returns high confidence for TLD matches', () => {
    const result = classifySite('https://www.navy.mil', 'US Navy', 'military defense');
    expect(result.confidence).toBe('high');
    expect(result.category.id).toBe('military');
  });

  it('classifies based on keyword content', () => {
    const result = classifySite(
      'https://some-cooking-blog.com',
      'Delicious Recipes',
      'cooking instructions prep time ingredients',
    );
    expect(result.category.id).toBe('food');
  });

  it('CATEGORIES has expected structure', () => {
    expect(Array.isArray(CATEGORIES)).toBe(true);
    expect(CATEGORIES.length).toBeGreaterThan(15);
    CATEGORIES.forEach((cat) => {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('emoji');
      expect(cat).toHaveProperty('cssClass');
      expect(cat).toHaveProperty('description');
      expect(cat).toHaveProperty('keywords');
    });
  });
});
