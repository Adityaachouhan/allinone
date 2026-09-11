/**
 * src/lib/theme.ts
 *
 * Dynamically generates and applies a 10-shade primary color palette (50-900)
 * from any arbitrary base color hex string selected via the color wheel.
 *
 * Sets CSS variables on :root (document.documentElement) so all Tailwind classes
 * (both `primary-*` and `green-*`) dynamically reflect the store's brand color
 * across both the customer storefront and admin dashboard.
 */

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return [22, 163, 74]; // fallback #16a34a
  }
  const n = parseInt(clean, 16);
  if (isNaN(n)) return [22, 163, 74];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }

  return [h, Math.round(s * 100), Math.round(l * 100)];
}

export function applyThemeColor(baseHex: string) {
  if (typeof document === 'undefined') return;

  const validHex = /^#[0-9a-fA-F]{3,6}$/.test(baseHex) ? baseHex : '#16a34a';
  const [r, g, b] = hexToRgb(validHex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Generate 10 harmonic shades
  const shades: Record<string, string> = {
    '--color-primary-50':  `hsl(${h}, ${Math.min(s, 95)}%, 96%)`,
    '--color-primary-100': `hsl(${h}, ${Math.min(s, 90)}%, 91%)`,
    '--color-primary-200': `hsl(${h}, ${Math.min(s, 85)}%, 82%)`,
    '--color-primary-300': `hsl(${h}, ${Math.min(s, 80)}%, 70%)`,
    '--color-primary-400': `hsl(${h}, ${Math.min(s, 75)}%, 58%)`,
    '--color-primary-500': `hsl(${h}, ${Math.min(s, 75)}%, 48%)`,
    '--color-primary-600': validHex,
    '--color-primary-700': `hsl(${h}, ${Math.min(s, 80)}%, ${Math.max(l - 9, 18)}%)`,
    '--color-primary-800': `hsl(${h}, ${Math.min(s, 85)}%, ${Math.max(l - 17, 12)}%)`,
    '--color-primary-900': `hsl(${h}, ${Math.min(s, 90)}%, ${Math.max(l - 24, 8)}%)`,
  };

  const root = document.documentElement;
  for (const [prop, val] of Object.entries(shades)) {
    root.style.setProperty(prop, val);
  }

  // Update browser mobile toolbar theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', validHex);
  }
}
