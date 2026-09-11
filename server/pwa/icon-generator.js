/**
 * server/pwa/icon-generator.js
 *
 * Generates a per-tenant PWA icon as an SVG string.
 * - If the tenant has a logo_url: caller should redirect to it directly (browser caches it).
 * - If no logo_url: generates a colored rounded-square SVG with the store's initials.
 *
 * No native dependencies (no canvas, no sharp) — pure SVG text generation.
 * Modern browsers (Chrome, Safari, Firefox) fully support SVG icons in web app manifests.
 *
 * Cache: in-memory Map keyed by `${slug}:${size}` — generated once per tenant per size.
 */

import { readFileSync, existsSync } from 'node:fs';

// ── In-memory icon cache ──────────────────────────────────────────────────────
const iconCache = new Map();

/**
 * Extract up to 2 initials from a store name.
 * "Bhardwaj Mart"  → "BM"
 * "FreshZone"      → "FZ"
 * "Aarav"          → "AA"
 * ""               → "G"
 * @param {string} name
 * @returns {string}
 */
function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'G';
  if (words.length === 1) {
    // Single word — use first two chars uppercased
    return words[0].slice(0, 2).toUpperCase();
  }
  // Multiple words — first char of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Generate an SVG icon for a store.
 *
 * @param {object} opts
 * @param {string} opts.storeName    - Display name of the store
 * @param {string} opts.themeColor   - Hex color e.g. '#16a34a'
 * @param {number} opts.size         - Width/height in px (192, 512, etc.)
 * @param {string} opts.cacheKey     - Unique cache key (slug:size)
 * @returns {string}                  SVG string
 */
export function generateInitialsSVG({ storeName, themeColor, size, cacheKey }) {
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  const initials  = getInitials(storeName);
  const color     = /^#[0-9a-fA-F]{3,6}$/.test(themeColor) ? themeColor : '#16a34a';
  const radius    = Math.round(size * 0.18);  // 18% corner radius — looks like iOS/Android icons
  const fontSize  = Math.round(size * 0.35);  // font size relative to icon size
  const center    = size / 2;

  // Derive a slightly darker shade for a gradient
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${darken(color)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)" />
  <text
    x="${center}"
    y="${center}"
    dy="0.36em"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="-${Math.round(fontSize * 0.03)}"
  >${initials}</text>
</svg>`;

  iconCache.set(cacheKey, svg);
  return svg;
}

/**
 * Very simple hex color darkener — produces a slightly darker shade
 * for the bottom-right gradient stop.
 * @param {string} hex
 * @returns {string}
 */
function darken(hex) {
  try {
    const n  = parseInt(hex.replace('#', ''), 16);
    const r  = Math.max(0, ((n >> 16) & 0xff) - 40);
    const g  = Math.max(0, ((n >> 8)  & 0xff) - 40);
    const b  = Math.max(0, (n         & 0xff) - 40);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  } catch {
    return '#0f7030';
  }
}

/**
 * Generate an adaptive, safe-zone padded SVG wrapper around any uploaded logo.
 * Uses `preserveAspectRatio="xMidYMid meet"` so wide, tall, or irregular images
 * are fitted completely into the icon frame without cutting edges.
 *
 * Embeds the file as an inline base64 data URI so the SVG is 100% self-contained
 * and requires no secondary network requests by Android WebAPK or iOS.
 *
 * @param {object} opts
 * @param {string} opts.filePath    - Local absolute disk path to uploaded image file
 * @param {string} opts.logoUrl     - Fallback relative or absolute URL
 * @param {string} opts.storeName   - Display name for fallback initials
 * @param {string} opts.themeColor  - Hex color e.g. '#16a34a'
 * @param {number} opts.size        - Width/height in px (192, 512, etc.)
 * @param {string} opts.cacheKey    - Unique cache key
 * @returns {string}                 SVG string
 */
export function generateAdaptiveLogoSVG({ filePath, logoUrl, storeName, themeColor, size = 512, cacheKey }) {
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  let imageHref = logoUrl;
  if (filePath && existsSync(filePath)) {
    try {
      const buffer = readFileSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      imageHref = `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      imageHref = logoUrl;
    }
  }

  if (!imageHref) {
    return generateInitialsSVG({ storeName, themeColor, size, cacheKey });
  }

  const color = /^#[0-9a-fA-F]{3,6}$/.test(themeColor) ? themeColor : '#16a34a';
  // 15% safe-zone margin guarantees Android adaptive mask never clips logo
  const pad = Math.round(size * 0.15);
  const innerSize = size - pad * 2;
  const outerRadius = Math.round(size * 0.22);
  const innerRadius = Math.round(size * 0.16);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="brandBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${darken(color)};stop-opacity:1" />
    </linearGradient>
    <filter id="plateShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${Math.round(size * 0.015)}" stdDeviation="${Math.round(size * 0.025)}" flood-opacity="0.15" />
    </filter>
  </defs>
  <!-- Outer brand background frame -->
  <rect width="${size}" height="${size}" rx="${outerRadius}" fill="url(#brandBg)" />
  <!-- Inner white card with safe-zone inset -->
  <rect x="${Math.round(size * 0.06)}" y="${Math.round(size * 0.06)}" width="${Math.round(size * 0.88)}" height="${Math.round(size * 0.88)}" rx="${innerRadius}" fill="#ffffff" filter="url(#plateShadow)" />
  <!-- Fitted logo image without edge-cutting -->
  <image href="${imageHref}" x="${pad}" y="${pad}" width="${innerSize}" height="${innerSize}" preserveAspectRatio="xMidYMid meet" />
</svg>`;

  iconCache.set(cacheKey, svg);
  return svg;
}

/**
 * Clear the icon cache for a specific tenant slug (call after logo/color update).
 * @param {string} slug
 */
export function clearIconCache(slug) {
  for (const key of iconCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      iconCache.delete(key);
    }
  }
}
