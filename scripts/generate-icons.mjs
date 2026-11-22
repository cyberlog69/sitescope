#!/usr/bin/env node
// Generates the PWA/app icons as real PNGs (no external dependencies).
// Run with `npm run icons` whenever the mark or palette changes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

// ── PNG encoding ────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

/** @param {Buffer} buf */
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * @param {number} width
 * @param {Buffer} rgba
 */
function encodePng(width, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * width);
  for (let y = 0; y < width; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing ─────────────────────────────────────────────────────────────────
const SS = 4; // supersampling factor

/** @param {number} v @param {number} min @param {number} max */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Distance from a point to a line segment.
 * @param {number} px @param {number} py
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Render one icon. `bleed` fills the whole square (maskable/apple icons);
 * otherwise the corners are transparent so the icon reads as a rounded tile.
 * @param {number} size
 * @param {{ bleed?: boolean }} [options]
 */
function renderIcon(size, options = {}) {
  const { bleed = false } = options;
  const width = size * SS;
  const rgba = Buffer.alloc(size * size * 4);

  const radius = 0.22; // rounded-square corner radius (normalized)
  const centerX = 0.42;
  const centerY = 0.40;
  const ringRadius = 0.20;
  const ringWidth = 0.068;
  const handleWidth = 0.072;
  // Handle runs from the ring's lower-right edge toward the bottom-right.
  const diagonal = Math.SQRT1_2;
  const handleStartX = centerX + (ringRadius + ringWidth / 2) * diagonal;
  const handleStartY = centerY + (ringRadius + ringWidth / 2) * diagonal;
  const handleEndX = 0.75;
  const handleEndY = 0.73;

  const violet = [124, 58, 237];
  const cyan = [6, 182, 212];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x * SS + sx + 0.5) / width;
          const ny = (y * SS + sy + 0.5) / width;

          // Rounded-square coverage.
          let insetX = 0;
          let insetY = 0;
          if (!bleed) {
            const qx = Math.max(Math.abs(nx - 0.5) - (0.5 - radius), 0);
            const qy = Math.max(Math.abs(ny - 0.5) - (0.5 - radius), 0);
            if (Math.hypot(qx, qy) > radius) continue;
          }
          insetX = nx;
          insetY = ny;

          // Diagonal violet → cyan gradient with a soft radial highlight.
          const t = clamp((insetX + insetY) / 2, 0, 1);
          const highlight = Math.max(0, 1 - Math.hypot(insetX - 0.3, insetY - 0.28) * 2.4) * 0.16;
          let pr = violet[0] + (cyan[0] - violet[0]) * t;
          let pg = violet[1] + (cyan[1] - violet[1]) * t;
          let pb = violet[2] + (cyan[2] - violet[2]) * t;
          pr = clamp(pr + highlight * 255, 0, 255);
          pg = clamp(pg + highlight * 255, 0, 255);
          pb = clamp(pb + highlight * 255, 0, 255);

          // Magnifier mark (white).
          const ring = Math.abs(Math.hypot(nx - centerX, ny - centerY) - ringRadius) <= ringWidth / 2;
          const handle =
            segmentDistance(nx, ny, handleStartX, handleStartY, handleEndX, handleEndY) <=
            handleWidth / 2;
          if (ring || handle) {
            const mix = 0.92;
            pr = pr * (1 - mix) + 255 * mix;
            pg = pg * (1 - mix) + 255 * mix;
            pb = pb * (1 - mix) + 255 * mix;
          }

          r += pr;
          g += pg;
          b += pb;
          a += 255;
        }
      }

      const samples = SS * SS;
      if (a > 0) {
        rgba[(y * size + x) * 4] = Math.round(r / (a / 255));
        rgba[(y * size + x) * 4 + 1] = Math.round(g / (a / 255));
        rgba[(y * size + x) * 4 + 2] = Math.round(b / (a / 255));
        rgba[(y * size + x) * 4 + 3] = Math.round(a / samples);
      }
    }
  }

  return encodePng(size, rgba);
}

mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-192.png', 192, { bleed: true }],
  ['icon-maskable-512.png', 512, { bleed: true }],
  ['apple-touch-icon.png', 180, { bleed: true }],
];

for (const [name, size, options] of targets) {
  writeFileSync(join(outDir, name), renderIcon(size, options));
  console.log(`icons/${name}`);
}

writeFileSync(
  join(root, 'public', 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <circle cx="42" cy="40" r="20" fill="none" stroke="#fff" stroke-width="6.8"/>
  <line x1="56.5" y1="54.5" x2="75" y2="73" stroke="#fff" stroke-width="7.2" stroke-linecap="round"/>
</svg>
`,
);
console.log('favicon.svg');
