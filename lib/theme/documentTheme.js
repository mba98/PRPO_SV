/**
 * Shared theme application (color mode + accent) — safe for client and bootstrap script.
 */

export const COLOR_MODE_STORAGE_KEY = 'procurement-color-mode';
export const DEFAULT_COLOR_MODE = 'dark';

export const ACCENT_STORAGE_KEY = 'procurement-accent-theme';
export const LEGACY_ACCENT_STORAGE_KEY = 'portal-accent-theme';

/** Map legacy 7-color ids to new palette ids */
export const LEGACY_ACCENT_MAP = {
  indigo: 'blue',
  blue: 'blue',
  emerald: 'emerald',
  amber: 'orange',
  rose: 'rose',
  violet: 'violet',
  slate: 'sky',
};

export function normalizeAccentId(id) {
  if (!id) return null;
  if (LEGACY_ACCENT_MAP[id]) return LEGACY_ACCENT_MAP[id];
  return id;
}

export function applyColorModeToDocument(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = mode === 'dark';
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function applyAccentVarsToDocument(accentId, accentCssVars) {
  if (typeof document === 'undefined') return;
  const vars = accentCssVars[accentId];
  if (!vars) return;
  const root = document.documentElement;
  root.setAttribute('data-accent', accentId);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.setProperty('--primary', vars['--accent-color'] || vars['--brand-600']);
  root.style.setProperty('--primary-foreground', '#ffffff');
  root.style.setProperty('--ring', vars['--accent-color'] || vars['--brand-600']);
}
