'use client';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  muted:
    'inline-flex min-h-10 items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/80',
};

const SPINNER_BORDER = {
  primary: 'border-primary-foreground',
  danger: 'border-destructive-foreground',
  secondary: 'border-foreground',
  ghost: 'border-foreground',
  muted: 'border-foreground',
};

const LABEL_CLASS = {
  primary: 'text-primary-foreground',
  danger: 'text-destructive-foreground',
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
  const spinnerBorder = SPINNER_BORDER[variant] || SPINNER_BORDER.primary;
  const labelClass = LABEL_CLASS[variant] || '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} inline-flex items-center justify-center gap-2 ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span
          className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent ${spinnerBorder}`}
          aria-hidden
        />
      ) : null}
      <span className={labelClass}>{children}</span>
    </button>
  );
}
