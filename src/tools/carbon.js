// @ts-check
// carbon.js — Carbon Footprint & Digital Eco-Score Calculator
// Standard: Sustainable Web Design Model v4 (SWDM)

/**
 * @typedef {{
 *   bytes: number,
 *   co2PerVisitGrams: number,
 *   co2PerVisitGramsFormatted: string,
 *   annualCo2Kg: number,
 *   annualCo2KgFormatted: string,
 *   treesNeeded: number,
 *   ecoGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
 *   cleanerThanPct: number,
 *   isGreenHost: boolean,
 *   tips: string[]
 * }} CarbonResult
 */

const KNOWN_GREEN_HOSTS = ['vercel', 'netlify', 'cloudflare', 'github', 'google', 'aws', 'amazon', 'azure', 'fastly'];

/**
 * Detect if headers or server indicate a green cloud host.
 * @param {Record<string, string>} [headers]
 * @returns {boolean}
 */
export function isGreenHosting(headers) {
  if (!headers) return false;
  const str = JSON.stringify(headers).toLowerCase();
  return KNOWN_GREEN_HOSTS.some((host) => str.includes(host));
}

/**
 * Calculate carbon footprint and Eco-Score grade for a given page byte size.
 * @param {number} byteSize
 * @param {boolean} [isGreen=false]
 * @returns {CarbonResult}
 */
export function calculateCarbonFootprint(byteSize, isGreen = false) {
  const bytes = Math.max(0, byteSize || 0);

  // SWDM Model v4 constants:
  // 0.81 kWh per GB of network & data center energy
  // Global grid carbon intensity = 442g CO2/kWh (Green host reduces intensity by 50%)
  const kwhPerByte = 0.81 / (1024 * 1024 * 1024);
  const carbonIntensity = isGreen ? 221 : 442;

  const co2Grams = bytes * kwhPerByte * carbonIntensity;
  const co2PerVisitGrams = Math.round(co2Grams * 1000) / 1000;

  // Annual CO2 for 10,000 monthly visits (120,000 visits/year)
  const annualCo2Kg = Math.round(((co2PerVisitGrams * 120000) / 1000) * 10) / 10;

  // Average mature tree absorbs ~21 kg of CO2 per year
  const treesNeeded = Math.max(1, Math.ceil(annualCo2Kg / 21));

  // Eco Grade calculation thresholds (grams CO2 per visit)
  /** @type {'A+' | 'A' | 'B' | 'C' | 'D' | 'F'} */
  let ecoGrade = 'F';
  if (co2PerVisitGrams <= 0.18) ecoGrade = 'A+';
  else if (co2PerVisitGrams <= 0.34) ecoGrade = 'A';
  else if (co2PerVisitGrams <= 0.49) ecoGrade = 'B';
  else if (co2PerVisitGrams <= 0.65) ecoGrade = 'C';
  else if (co2PerVisitGrams <= 0.85) ecoGrade = 'D';

  // Percentile cleaner than global web average (~0.85g CO2 per visit)
  const cleanerThanPct = Math.max(0, Math.min(99, Math.round(((0.85 - co2PerVisitGrams) / 0.85) * 100)));

  const tips = [];
  if (bytes > 1500000) tips.push('Compress and optimize heavy images (JPEG/PNG to WebP/AVIF).');
  if (bytes > 3000000) tips.push('Minify JavaScript bundles and defer non-critical scripts.');
  if (!isGreen) tips.push('Switch to a certified green hosting provider powered by 100% renewable energy.');
  if (tips.length === 0) tips.push('Great job! This page is lightweight and eco-friendly.');

  return {
    bytes,
    co2PerVisitGrams,
    co2PerVisitGramsFormatted: `${co2PerVisitGrams} g`,
    annualCo2Kg,
    annualCo2KgFormatted: `${annualCo2Kg} kg`,
    treesNeeded,
    ecoGrade,
    cleanerThanPct,
    isGreenHost: isGreen,
    tips
  };
}
