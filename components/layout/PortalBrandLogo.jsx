'use client';

import { getPortalLogoSrc } from '@/lib/branding/portalLogos';
import { useThemeStore } from '@/stores/themeStore';

export default function PortalBrandLogo({ brand, className = '', priority = false }) {
  const mode = useThemeStore((s) => s.mode);
  const src = getPortalLogoSrc(brand, mode);
  const alt = brand === 'sv' ? 'SV' : 'SPC';

  return (
    <div
      className={`flex h-8 shrink-0 items-center sm:h-10 lg:h-11 ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={140}
        height={44}
        loading={priority ? 'eager' : 'lazy'}
        className="h-8 w-auto max-w-[8.5rem] object-contain sm:h-10 sm:max-w-[9.5rem] lg:h-11 lg:max-w-[10.5rem]"
      />
    </div>
  );
}
