'use client';

export default function FormField({ label, htmlFor, error, hint, required, children, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm ${className}`.trim()}>
      {label && (
        <span className="form-label">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </span>
      )}
      <div className={label ? 'mt-1' : ''}>{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
