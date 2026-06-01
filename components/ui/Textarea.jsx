'use client';

const TEXTAREA_BASE_CLASS =
  'min-h-[120px] w-full resize-y rounded-2xl border border-border bg-input px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50';

export default function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`${TEXTAREA_BASE_CLASS} ${className}`.trim()}
      {...props}
    />
  );
}
