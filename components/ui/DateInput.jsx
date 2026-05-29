'use client';

export default function DateInput({ className = '', ...props }) {
  return <input type="date" className={`input-field font-mono-ltr ${className}`.trim()} {...props} />;
}
