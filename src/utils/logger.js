// @ts-check
// logger.js — thin console wrapper so we have one place to silence/redirect
// diagnostic output (e.g. in production builds) instead of calling
// console.* directly from feature code.

/**
 * Log a recoverable/expected failure (network error, proxy failure, etc).
 * @param {string} scope - short tag identifying the origin, e.g. 'history:cloud-sync'
 * @param {unknown} err
 * @returns {void}
 */
export function logWarn(scope, err) {
  // eslint-disable-next-line no-console
  console.warn(`[${scope}]`, err);
}

/**
 * Log an unexpected error.
 * @param {string} scope
 * @param {unknown} err
 * @returns {void}
 */
export function logError(scope, err) {
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, err);
}
