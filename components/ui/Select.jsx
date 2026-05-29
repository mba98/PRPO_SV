'use client';

export default function Select({ className = '', children, ...props }) {
  return (
    <select className={`input-field ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
