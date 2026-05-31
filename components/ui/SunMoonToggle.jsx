'use client';

import { useI18n } from '@/lib/hooks/useI18n';
import { useThemeStore } from '@/stores/themeStore';

export default function SunMoonToggle({ className = '' }) {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const { common } = useI18n();

  const isDark = mode === 'dark';
  const ariaLabel = isDark ? common.switchToLightMode : common.switchToDarkMode;

  return (
    <button
      type="button"
      className={`topbar-icon-btn sun-moon-toggle ${className}`.trim()}
      onClick={toggleMode}
      aria-label={ariaLabel}
      aria-pressed={isDark}
      title={ariaLabel}
    >
      <span className="sun-moon-toggle-inner">
        <svg
          className="sun-moon-svg"
          viewBox="0 0 24 24"
          aria-hidden
          xmlns="http://www.w3.org/2000/svg"
        >
          <g className="sun-moon-rays">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect
                key={deg}
                x="11"
                y="1"
                width="2"
                height="4"
                rx="1"
                transform={`rotate(${deg} 12 12)`}
              />
            ))}
          </g>
          <circle className="sun-moon-body" cx="12" cy="12" r="5" />
          <circle className="sun-moon-mask" cx="18" cy="10" r="6" />
        </svg>
      </span>
    </button>
  );
}
