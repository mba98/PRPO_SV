/** Public paths for portal brand logos (place files in /public). */
export const PORTAL_LOGOS = {
  sv: {
    dark: '/svnewlogo-dark1.png',
    light: '/svnewlogo-light1.png',
  },
  spc: {
    dark: '/spclogo-night.png',
    light: '/spclogo-light.png',
  },
};

export function getPortalLogoSrc(brand, mode) {
  const isDark = mode === 'dark';
  const assets = PORTAL_LOGOS[brand];
  if (!assets) return '';
  return isDark ? assets.dark : assets.light;
}
