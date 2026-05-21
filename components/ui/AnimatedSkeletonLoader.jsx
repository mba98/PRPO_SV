'use client';

const VARIANTS = {
  table: 'space-y-3',
  card: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  detail: 'space-y-6',
  timeline: 'space-y-4',
  dropdown: 'space-y-2',
};

function ShimmerBlock({ className }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${className}`}
      style={{ animation: 'shimmer 1.6s linear infinite' }}
    />
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className={VARIANTS.table}>
      <ShimmerBlock className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerBlock key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 3 }) {
  return (
    <div className={VARIANTS.card}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerBlock key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

export function SkeletonDetailPage() {
  return (
    <div className={VARIANTS.detail}>
      <ShimmerBlock className="h-8 w-1/3" />
      <ShimmerBlock className="h-32 w-full" />
      <ShimmerBlock className="h-48 w-full" />
    </div>
  );
}

export function SkeletonTimeline({ steps = 4 }) {
  return (
    <div className={VARIANTS.timeline}>
      {Array.from({ length: steps }).map((_, i) => (
        <ShimmerBlock key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function SkeletonDropdown({ rows = 4 }) {
  return (
    <div className={VARIANTS.dropdown}>
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerBlock key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export default function AnimatedSkeletonLoader({ variant = 'table', ...props }) {
  switch (variant) {
    case 'card':
      return <SkeletonCard {...props} />;
    case 'detail':
      return <SkeletonDetailPage />;
    case 'timeline':
      return <SkeletonTimeline {...props} />;
    case 'dropdown':
      return <SkeletonDropdown {...props} />;
    default:
      return <SkeletonTable {...props} />;
  }
}
