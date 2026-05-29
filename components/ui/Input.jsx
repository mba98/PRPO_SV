'use client';

export default function Input({ className = '', mono = false, ...props }) {
  return (
    <input
      className={`input-field ${mono ? 'font-mono-ltr font-mono text-sm' : ''} ${className}`.trim()}
      {...props}
    />
  );
}
