'use client';

export default function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`input-field min-h-[100px] resize-y ${className}`.trim()}
      {...props}
    />
  );
}
