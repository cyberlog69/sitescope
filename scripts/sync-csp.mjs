#!/usr/bin/env node
// Keep the CSP identical across the three places that deliver it.
// Usage: node scripts/sync-csp.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CSP_META, CSP_HEADER } from '../config/csp.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

/**
 * @param {string} file
 * @param {RegExp} pattern
 * @param {string} replacement
 * @returns {boolean} true when the file already matched
 */
function apply(file, pattern, replacement) {
  const path = join(root, file);
  const source = readFileSync(path, 'utf8');
  if (!pattern.test(source)) {
    throw new Error(`CSP anchor not found in ${file} (pattern: ${pattern})`);
  }
  const next = source.replace(pattern, replacement);
  if (next === source) return true;
  if (!checkOnly) writeFileSync(path, next);
  console.error(`CSP drift in ${file}`);
  return false;
}

const results = [
  apply(
    'index.html',
    /<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
    `<meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`,
  ),
  apply(
    'vercel.json',
    /("key":\s*"Content-Security-Policy",\s*"value":\s*)"[^"]*"/,
    `$1"${CSP_HEADER}"`,
  ),
  apply(
    'nginx.conf',
    /add_header Content-Security-Policy "[^"]*" always;/,
    `add_header Content-Security-Policy "${CSP_HEADER}" always;`,
  ),
];

if (results.every(Boolean)) {
  console.log('CSP is in sync across index.html, vercel.json and nginx.conf.');
} else if (checkOnly) {
  process.exitCode = 1;
} else {
  console.log('CSP updated. Review and commit the changed files.');
}
