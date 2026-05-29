'use client';

export default function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`btn-ghost ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
