'use client';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  muted:
    'inline-flex min-h-10 items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/80',
};

export default function Button({
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const base = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} gap-2 ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
