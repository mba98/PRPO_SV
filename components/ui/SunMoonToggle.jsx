'use client';

import { useId } from 'react';
import { useI18n } from '@/lib/hooks/useI18n';
import { useThemeStore } from '@/stores/themeStore';

export default function SunMoonToggle({ size = 'md', className = '' }) {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const { common } = useI18n();
  const maskId = useId();

  const isLight = mode === 'light';
  const ariaLabel = isLight ? common.switchToDarkMode : common.switchToLightMode;

  const sizeClass = size === 'sm' ? 'sun-moon-toggle--sm' : 'sun-moon-toggle--md';
  const modeClass = isLight ? 'sun-moon-toggle-light' : 'sun-moon-toggle-dark';

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={ariaLabel}
      aria-pressed={!isLight}
      title={ariaLabel}
      className={['sun-moon-toggle', sizeClass, modeClass, className].filter(Boolean).join(' ')}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="currentColor"
        stroke="none"
        aria-hidden
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="20" height="20" fill="white" />
          <circle className="sun-moon-mask-circle" cx="11" cy="3" r="8" fill="black" />
        </mask>
        <circle className="sunMoon" cx="10" cy="10" r="8" mask={`url(#${maskId})`} />
        <g className="sunRays">
          <circle className="sunRay sunRay1" cx="18" cy="10" r="1.5" />
          <circle className="sunRay sunRay2" cx="14" cy="16.928" r="1.5" />
          <circle className="sunRay sunRay3" cx="6" cy="16.928" r="1.5" />
          <circle className="sunRay sunRay4" cx="2" cy="10" r="1.5" />
          <circle className="sunRay sunRay5" cx="6" cy="3.1718" r="1.5" />
          <circle className="sunRay sunRay6" cx="14" cy="3.1718" r="1.5" />
        </g>
      </svg>
    </button>
  );
}
