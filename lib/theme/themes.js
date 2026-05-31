/** HRMS accent palette — 10 colors (exact hex from design spec) */

export const ACCENT_PALETTE = [
  { id: 'rose', hex: '#e11d48', labelAr: 'وردي غامق', labelEn: 'Rose' },
  { id: 'pink', hex: '#f472b6', labelAr: 'وردي', labelEn: 'Pink' },
  { id: 'orange', hex: '#fb923c', labelAr: 'برتقالي', labelEn: 'Orange' },
  { id: 'yellow', hex: '#facc15', labelAr: 'أصفر', labelEn: 'Yellow' },
  { id: 'lime', hex: '#84cc16', labelAr: 'ليموني', labelEn: 'Lime' },
  { id: 'emerald', hex: '#10b981', labelAr: 'زمردي', labelEn: 'Emerald' },
  { id: 'sky', hex: '#0ea5e9', labelAr: 'سماوي', labelEn: 'Sky' },
  { id: 'blue', hex: '#3b82f6', labelAr: 'أزرق', labelEn: 'Blue' },
  { id: 'violet', hex: '#8b5cf6', labelAr: 'بنفسجي', labelEn: 'Violet' },
  { id: 'purple', hex: '#a78bfa', labelAr: 'أرجواني', labelEn: 'Purple' },
];

/** @deprecated use ACCENT_PALETTE — kept for tests mentioning ACCENT_THEMES */
export const ACCENT_THEMES = ACCENT_PALETTE;

export const DEFAULT_ACCENT = 'blue';

export const THEME_STORAGE_KEY = 'procurement-accent-theme';

function tint(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

/** Per-accent CSS variables applied to documentElement */
export const ACCENT_CSS_VARS = Object.fromEntries(
  ACCENT_PALETTE.map(({ id, hex }) => [
    id,
    {
      '--accent-color': hex,
      '--brand-500': hex,
      '--brand-600': hex,
      '--brand-700': hex,
      '--brand-100': tint(hex, '22'),
      '--brand-50': tint(hex, '14'),
      '--brand-900': hex,
    },
  ]),
);
