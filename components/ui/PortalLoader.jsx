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

  const cardClass = [
    'portal-loader-card',
    size === 'sm' ? 'portal-loader-card--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const loaderClass = ['portal-loader', size === 'sm' ? 'portal-loader--sm' : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={cardClass}>
      <div className={loaderClass}>
        <p className="portal-loader-base">{base}</p>
        <div className="portal-loader-words" aria-hidden>
          {LOADER_WORDS.map((word, index) => (
            <span key={`${word}-${index}`} className="portal-loader-word">
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="flex w-full items-center justify-center bg-background py-16"
        style={{ minHeight: '50vh' }}
        role="status"
        aria-live="polite"
        aria-label={base}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-10" role="status" aria-live="polite" aria-label={base}>
      {content}
    </div>
  );
}
