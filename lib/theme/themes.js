/** Accent theme definitions — applied via data-accent on <html> */
export const ACCENT_THEMES = [
  { id: 'indigo', labelAr: 'نيلي', labelEn: 'Indigo' },
  { id: 'blue', labelAr: 'أزرق', labelEn: 'Blue' },
  { id: 'emerald', labelAr: 'زمردي', labelEn: 'Emerald' },
  { id: 'amber', labelAr: 'كهرماني', labelEn: 'Amber' },
  { id: 'rose', labelAr: 'وردي', labelEn: 'Rose' },
  { id: 'violet', labelAr: 'بنفسجي', labelEn: 'Violet' },
  { id: 'slate', labelAr: 'رمادي', labelEn: 'Slate' },
];

export const DEFAULT_ACCENT = 'indigo';

export const THEME_STORAGE_KEY = 'portal-accent-theme';

/** CSS variable maps per accent (brand scale) */
export const ACCENT_CSS_VARS = {
  indigo: {
    '--brand-50': '#eef2ff',
    '--brand-100': '#e0e7ff',
    '--brand-500': '#6366f1',
    '--brand-600': '#4f46e5',
    '--brand-700': '#4338ca',
    '--brand-900': '#312e81',
  },
  blue: {
    '--brand-50': '#eff6ff',
    '--brand-100': '#dbeafe',
    '--brand-500': '#3b82f6',
    '--brand-600': '#2563eb',
    '--brand-700': '#1d4ed8',
    '--brand-900': '#1e3a8a',
  },
  emerald: {
    '--brand-50': '#ecfdf5',
    '--brand-100': '#d1fae5',
    '--brand-500': '#10b981',
    '--brand-600': '#059669',
    '--brand-700': '#047857',
    '--brand-900': '#064e3b',
  },
  amber: {
    '--brand-50': '#fffbeb',
    '--brand-100': '#fef3c7',
    '--brand-500': '#f59e0b',
    '--brand-600': '#d97706',
    '--brand-700': '#b45309',
    '--brand-900': '#78350f',
  },
  rose: {
    '--brand-50': '#fff1f2',
    '--brand-100': '#ffe4e6',
    '--brand-500': '#f43f5e',
    '--brand-600': '#e11d48',
    '--brand-700': '#be123c',
    '--brand-900': '#881337',
  },
  violet: {
    '--brand-50': '#f5f3ff',
    '--brand-100': '#ede9fe',
    '--brand-500': '#8b5cf6',
    '--brand-600': '#7c3aed',
    '--brand-700': '#6d28d9',
    '--brand-900': '#4c1d95',
  },
  slate: {
    '--brand-50': '#f8fafc',
    '--brand-100': '#f1f5f9',
    '--brand-500': '#64748b',
    '--brand-600': '#475569',
    '--brand-700': '#334155',
    '--brand-900': '#0f172a',
  },
};
