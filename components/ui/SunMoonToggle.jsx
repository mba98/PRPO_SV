'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/hooks/useI18n';
import { useThemeStore } from '@/stores/themeStore';

export default function SunMoonToggle({ className = '' }) {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const { common } = useI18n();
  const reduceMotion = useReducedMotion();

  const isDark = mode === 'dark';
  const ariaLabel = isDark ? common.switchToLightMode : common.switchToDarkMode;

  const iconMotion = reduceMotion
    ? {}
    : {
        rotate: isDark ? 40 : 0,
        scale: isDark ? 0.92 : 1,
        transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
      };

  return (
    <motion.button
      type="button"
      className={`topbar-icon-btn sun-moon-toggle ${isDark ? 'sun-moon-toggle--dark' : 'sun-moon-toggle--light'} ${className}`.trim()}
      onClick={toggleMode}
      aria-label={ariaLabel}
      aria-pressed={isDark}
      title={ariaLabel}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
    >
      <motion.span className="sun-moon-toggle-inner" animate={iconMotion}>
        <svg
          className="sun-moon-svg"
          viewBox="0 0 24 24"
          aria-hidden
          xmlns="http://www.w3.org/2000/svg"
        >
          <g className="sun-moon-rays" fill="currentColor">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect
                key={deg}
                x="11"
                y="1.5"
                width="2"
                height="4.5"
                rx="1"
                transform={`rotate(${deg} 12 12)`}
              />
            ))}
          </g>
          <circle className="sun-moon-body" cx="12" cy="12" r="5.25" fill="currentColor" />
          <circle className="sun-moon-mask" cx="17" cy="10" r="6.5" />
        </svg>
      </motion.span>
    </motion.button>
  );
}
