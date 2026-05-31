import { ACCENT_CSS_VARS, DEFAULT_ACCENT } from './themes';
import { LEGACY_ACCENT_MAP } from './documentTheme';

/**
 * Inline IIFE applied in <head> before React hydration.
 * Must stay dependency-free (no imports at runtime in browser).
 */
export function buildThemeBootstrapScript() {
  const accentMap = {};
  Object.entries(ACCENT_CSS_VARS).forEach(([id, vars]) => {
    accentMap[id] = vars['--accent-color'] || vars['--brand-600'];
  });

  const legacyMap = LEGACY_ACCENT_MAP;

  return `(function(){try{
var l=localStorage.getItem('procurement-locale')||'ar';
document.documentElement.lang=l;
document.documentElement.dir=l==='en'?'ltr':'rtl';
var m=localStorage.getItem('procurement-color-mode');
var dark=m!=='light';
document.documentElement.classList.toggle('dark',dark);
document.documentElement.setAttribute('data-theme',dark?'dark':'light');
document.documentElement.style.colorScheme=dark?'dark':'light';
var a=localStorage.getItem('procurement-accent-theme')||localStorage.getItem('portal-accent-theme')||'${DEFAULT_ACCENT}';
var legacy=${JSON.stringify(legacyMap)};
if(legacy[a])a=legacy[a];
var colors=${JSON.stringify(accentMap)};
var hex=colors[a]||colors['${DEFAULT_ACCENT}'];
document.documentElement.setAttribute('data-accent',a);
document.documentElement.style.setProperty('--primary',hex);
document.documentElement.style.setProperty('--ring',hex);
document.documentElement.style.setProperty('--brand-600',hex);
document.documentElement.style.setProperty('--brand-500',hex);
document.documentElement.style.setProperty('--accent-color',hex);
document.documentElement.style.setProperty('--primary-foreground','#ffffff');
}catch(e){
document.documentElement.classList.add('dark');
document.documentElement.setAttribute('data-theme','dark');
document.documentElement.style.colorScheme='dark';
}})();`;
}
