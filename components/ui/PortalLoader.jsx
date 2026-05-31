'use client';

import { useI18n } from '@/lib/hooks/useI18n';

const LOADER_WORDS = ['SV', 'PR', 'PO', 'Portal', 'SV'];

export default function PortalLoader({
  label,
  size = 'md',
  fullScreen = false,
  className = '',
}) {
  const { common } = useI18n();
  const base = label ?? common.loading;

  const text = (
    <div
      className={`portal-loader-text ${size === 'sm' ? 'portal-loader-text--sm' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={base}
    >
      <span>{base}</span>
      <span className="portal-loader-words" aria-hidden>
        {LOADER_WORDS.map((word, index) => (
          <span key={`${word}-${index}`} className="portal-loader-word">
            {word}
          </span>
        ))}
      </span>
    </div>
  );

  if (fullScreen) {
    return <div className="portal-loader-screen">{text}</div>;
  }

  return text;
}
