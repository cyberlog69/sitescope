#!/usr/bin/env node
// Generates a typed DOM reference map from index.html.
// main.js imports this instead of calling document.getElementById() 200+ times,
// which gives TypeScript real element types and fails fast if markup drifts.
// Run with `npm run dom:sync` after changing element ids.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const html = readFileSync(join(root, 'index.html'), 'utf8');

/** @type {Record<string, string>} */
const INTERFACES = {
  a: 'HTMLAnchorElement',
  button: 'HTMLButtonElement',
  canvas: 'HTMLCanvasElement',
  div: 'HTMLDivElement',
  form: 'HTMLFormElement',
  h1: 'HTMLHeadingElement',
  h2: 'HTMLHeadingElement',
  h3: 'HTMLHeadingElement',
  h4: 'HTMLHeadingElement',
  h5: 'HTMLHeadingElement',
  h6: 'HTMLHeadingElement',
  iframe: 'HTMLIFrameElement',
  img: 'HTMLImageElement',
  input: 'HTMLInputElement',
  label: 'HTMLLabelElement',
  li: 'HTMLLIElement',
  p: 'HTMLParagraphElement',
  section: 'HTMLElement',
  select: 'HTMLSelectElement',
  span: 'HTMLSpanElement',
  table: 'HTMLTableElement',
  tbody: 'HTMLTableSectionElement',
  td: 'HTMLTableCellElement',
  textarea: 'HTMLTextAreaElement',
  th: 'HTMLTableCellElement',
  thead: 'HTMLTableSectionElement',
  tr: 'HTMLTableRowElement',
  ul: 'HTMLUListElement',
};

/** @type {Map<string, string>} */
const elements = new Map();
const tagPattern = /<([a-zA-Z][\w-]*)\b[^>]*?\bid\s*=\s*"([^"]+)"/g;
let match;
while ((match = tagPattern.exec(html))) {
  const [, tag, id] = match;
  if (elements.has(id)) continue;
  elements.set(id, INTERFACES[tag.toLowerCase()] || 'HTMLElement');
}

const isIdentifier = (/** @type {string} */ key) => /^[A-Za-z_$][\w$]*$/.test(key);
const lines = [...elements.entries()].map(([id, type]) => {
  const key = isIdentifier(id) ? id : `'${id}'`;
  return `  ${key}: /** @type {${type}} */ (must('${id}')),`;
});

const output = `// @ts-check
// GENERATED FILE — do not edit by hand. Run \`npm run dom:sync\`.
// Typed references for every element id in index.html. Importing this module
// fails fast (with a clear message) if markup and code drift apart.

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function must(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(\`Missing required element #\${id} — update index.html or the DOM map\`);
  return element;
}

export const dom = Object.freeze({
${lines.join('\n')}
});
`;

const target = join(root, 'src', 'main', 'dom.js');
if (checkOnly) {
  const current = readFileSync(target, 'utf8');
  if (current !== output) {
    console.error('src/main/dom.js is out of date. Run `npm run dom:sync`.');
    process.exitCode = 1;
  } else {
    console.log('src/main/dom.js is in sync with index.html.');
  }
} else {
  writeFileSync(target, output);
  console.log(`src/main/dom.js — ${elements.size} elements`);
}
