import { describe, it, expect, vi, afterEach } from 'vitest';
import { logWarn, logError } from './logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('logWarn forwards to console.warn with a scope prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('boom');
    logWarn('test:scope', err);
    expect(spy).toHaveBeenCalledWith('[test:scope]', err);
  });

  it('logError forwards to console.error with a scope prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('test:scope', 'bad');
    expect(spy).toHaveBeenCalledWith('[test:scope]', 'bad');
  });

  it('accepts non-Error values', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => logWarn('test', null)).not.toThrow();
    expect(spy).toHaveBeenCalledWith('[test]', null);
  });
});
